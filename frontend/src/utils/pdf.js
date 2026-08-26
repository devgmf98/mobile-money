import jsPDF from 'jspdf';
import mpLogo from '../assets/mp-logo.png';

// jsPDF.addImage needs pixel data, not a URL, so decode the bundled logo once
// through a canvas and cache the result. Resolves to null if anything fails,
// in which case the receipt falls back to a text wordmark.
let logoPromise = null;
const loadLogo = () => {
  if (logoPromise) return logoPromise;
  logoPromise = new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ data: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = mpLogo;
    } catch (e) {
      resolve(null);
    }
  });
  return logoPromise;
};

/* ==========================================================================
   Transaction receipt PDF
   Drawn to mirror the on-screen / printed receipt: brand header, uppercase
   section rules, label-value rows, an amount table with a tinted head and a
   solid green total row.

   Drawn with jsPDF primitives rather than rasterising the DOM, because this is
   also called from the transactions tables where the receipt modal is not
   mounted and there would be nothing to capture.
   ========================================================================== */

// Sequelize returns DECIMAL columns as strings, so coerce before arithmetic.
const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v, code) => `${code} ${num(v).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

// jsPDF's standard fonts are WinAnsi. Characters outside it render as garbage
// — the stored description contains U+2192 and was printing as "!'".
const ASCII = { '→': '->', '←': '<-', '–': '-', '—': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', ' ': ' ' };
const safe = (v) => String(v ?? '')
  .replace(/[→←–—‘’“”… ]/g, (c) => ASCII[c])
  .replace(/[^\x20-\xFF]/g, '');

const TYPE_LABELS = {
  transfer: 'Money Transfer',
  topup: 'Account Top-up',
  withdrawal: 'Withdrawal',
  user_withdraw: 'User Withdrawal',
  agent_deposit: 'Agent Deposit',
  agent_cash_out_money: 'Agent Cash Out',
  admin_push: 'Refunded by Admin',
  admin_state_push: 'State Push',
  money_exchange: 'Money Exchange',
};

const when = (v) => {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
};

// brand palette, matching the receipt
const GREEN = [0, 168, 107];
const GREEN_DARK = [8, 116, 67];
const INK = [30, 41, 59];
const MUTED = [100, 116, 139];
const RULE = [226, 232, 240];
const TINT = [248, 250, 252];

export const generateTransactionDocument = async (tx) => {
  try {
    if (!tx) throw new Error('No transaction supplied');
    const logo = await loadLogo();

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const M = 16;                      // page margin
    const W = pageW - M * 2;           // content width
    const RIGHT = M + W;

    const code = tx.currencyCode || 'SSP';
    const toCode = tx.toCurrencyCode || tx.currencySymbol || '';
    const isExchange = tx.type === 'money_exchange';
    const agent = num(tx.agentCommission);
    const company = num(tx.companyCommission);
    const totalCommission = agent + company;

    let y = 0;

    /* ---- brand header: logo centred on white, like the printed receipt ---- */
    y = 18;
    if (logo) {
      const logoW = 52;                              // mm
      const logoH = (logo.h / logo.w) * logoW;
      pdf.addImage(logo.data, 'PNG', (pageW - logoW) / 2, y - 6, logoW, logoH);
      y += logoH;
    } else {
      // fallback if the image could not be decoded
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(...GREEN_DARK);
      pdf.text('MoneyPay', pageW / 2, y, { align: 'center' });
      y += 6;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...INK);
    pdf.text('TRANSACTION RECEIPT', pageW / 2, y, { align: 'center' });
    y += 4;

    pdf.setDrawColor(...GREEN);
    pdf.setLineWidth(0.8);
    pdf.line(M, y, RIGHT, y);
    y += 10;

    /* ---- helpers ---- */
    const section = (title) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(...MUTED);
      pdf.text(safe(title).toUpperCase(), M, y);
      y += 2;
      pdf.setDrawColor(...RULE);
      pdf.setLineWidth(0.3);
      pdf.line(M, y, RIGHT, y);
      y += 6;
    };

    const row = (label, value) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9.5);
      pdf.setTextColor(...MUTED);
      pdf.text(safe(label), M, y);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...INK);
      const lines = pdf.splitTextToSize(safe(value), W - 55);
      pdf.text(lines, RIGHT, y, { align: 'right' });
      y += lines.length * 5 + 2.5;
    };

    /* ---- receipt details ---- */
    section('Receipt details');
    row('Transaction ID', tx.transactionId);
    row('Date & time', when(tx.createdAt));
    row('Type', TYPE_LABELS[tx.type] || String(tx.type || '').replace(/_/g, ' '));
    y += 4;

    /* ---- parties ---- */
    section('Parties');
    row('From', tx.sender?.name || tx.sender?.phone || 'System');
    row('To', tx.receiver?.name || tx.receiver?.phone || 'N/A');
    y += 4;

    /* ---- amount table ---- */
    section('Amount details');

    const tableRows = [];
    if (isExchange) {
      tableRows.push(['Amount converted', money(tx.amount, code)]);
      if (tx.exchangeRate) tableRows.push(['Rate applied', `1 ${code} = ${num(tx.exchangeRate)} ${toCode}`]);
      if (tx.exchangeMode) {
        const m = String(tx.exchangeMode);
        tableRows.push(['Exchange mode', m.charAt(0).toUpperCase() + m.slice(1)]);
      }
    } else {
      tableRows.push(['Transaction amount', money(tx.amount, code)]);
      if (agent > 0) tableRows.push([`Agent commission (${num(tx.agentCommissionPercent)}%)`, money(agent, code)]);
      if (company > 0) tableRows.push([`Company commission (${num(tx.companyCommissionPercent)}%)`, money(company, code)]);
      if (totalCommission > 0) tableRows.push(['Total commission fee', money(totalCommission, code)]);
    }

    // table head
    const th = 8;
    pdf.setFillColor(...TINT);
    pdf.rect(M, y - 5, W, th, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text('DESCRIPTION', M + 3, y);
    pdf.text('AMOUNT', RIGHT - 3, y, { align: 'right' });
    y += th - 1;

    // table body
    pdf.setFontSize(9.5);
    for (const [label, value] of tableRows) {
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...INK);
      pdf.text(safe(label), M + 3, y);
      pdf.setFont('helvetica', 'bold');
      pdf.text(safe(value), RIGHT - 3, y, { align: 'right' });
      y += 2.5;
      pdf.setDrawColor(...RULE);
      pdf.setLineWidth(0.2);
      pdf.line(M, y, RIGHT, y);
      y += 5.5;
    }

    // total row — solid green, mirroring the receipt
    const totalLabel = isExchange ? 'RECIPIENT RECEIVES' : 'TOTAL PAYMENT';
    const totalValue = isExchange
      ? money(tx.convertedAmount ?? tx.receiverCredit, toCode || code)
      : money(num(tx.amount) + totalCommission, code);

    const trH = 11;
    pdf.setFillColor(...GREEN);
    pdf.rect(M, y - 4, W, trH, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(totalLabel, M + 3, y + 3);
    pdf.setFontSize(12);
    pdf.text(safe(totalValue), RIGHT - 3, y + 3, { align: 'right' });
    y += trH + 6;

    /* ---- status ---- */
    section('Status');
    row('Status', String(tx.status || 'Unknown').toUpperCase());
    if (tx.description) row('Description', tx.description);

    /* ---- footer, placed under the content rather than pinned to the page
            bottom, so a short receipt never spills onto a second page ---- */
    y += 6;
    pdf.setDrawColor(...RULE);
    pdf.setLineWidth(0.3);
    pdf.line(M, y, RIGHT, y);
    y += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...GREEN_DARK);
    pdf.text('Thank you for using MoneyPay', pageW / 2, y, { align: 'center' });
    y += 5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(...MUTED);
    pdf.text(`Generated ${new Date().toLocaleString()}`, pageW / 2, y, { align: 'center' });
    y += 4;
    pdf.text('Support: support@moneypay.app', pageW / 2, y, { align: 'center' });

    const safeId = String(tx.transactionId || 'receipt').replace(/[^\w-]/g, '_');
    pdf.save(`receipt_${safeId}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Failed to generate PDF: ' + (error?.message || 'unknown error'));
    return false;
  }
};
