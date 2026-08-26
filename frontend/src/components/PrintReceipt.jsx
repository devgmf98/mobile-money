import React from 'react';
import { placeLabel } from '../utils/location';
import { generateTransactionDocument } from '../utils/pdf';
import mpLogo from '../assets/mp-logo.png';
import '../styles/print-receipt.css';
import { Download, FileText, Printer, X } from 'lucide-react';

// Matches the Transaction.type enum exactly. Previously two divergent copies
// of this map lived inside the component, and neither covered money_exchange,
// so receipts printed the raw "money_exchange" string.
const TRANSACTION_TYPES = {
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

const typeName = (t) => TRANSACTION_TYPES[t] || String(t || '').replace(/_/g, ' ');

// DECIMAL columns arrive as strings, so coerce before any arithmetic.
const n2 = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (v, code) => code + ' ' + n2(v).toLocaleString(undefined, {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});


export default function PrintReceipt({ transaction, onClose }) {
  // The receipt hardcoded "SSP", so a USD transaction printed as SSP.
  // Use whatever currency the row actually carries.
  const curCode = transaction?.currencyCode || 'SSP';
  // A money exchange has no commission and a second currency, so it needs a
  // different set of rows from a transfer.
  const isExchange = transaction?.type === 'money_exchange';
  // The print iframe is written with document.write and has no base URL, so
  // the logo needs an absolute src.
  const logoUrl = typeof window !== 'undefined'
    ? new URL(mpLogo, window.location.origin).href
    : mpLogo;
  const toCode = transaction?.toCurrencyCode || transaction?.currencySymbol || '';
  const totalCommission = n2(transaction?.agentCommission) + n2(transaction?.companyCommission);
  const hasCommission = totalCommission > 0;
  if (!transaction) return null;

  // Renders the receipt into a hidden iframe and prints that, so the printout
  // is the receipt alone rather than the whole admin page.
  const handlePrint = () => {
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };
    const getTransactionType = (type) => typeName(type);
    /* The location fields are JSON strings, so reading .city off them gave
       undefined and printed "Unknown, Unknown". When nothing can be resolved
       the row is dropped rather than showing a placeholder. */
    const senderPlace = placeLabel(transaction.senderLocation);
    const receiverPlace = placeLabel(transaction.receiverLocation);
    const senderLocationHtml = senderPlace ? `<div class="receipt-row"><span class="label">From Location:</span><span class="value">${senderPlace}</span></div>` : '';
    const receiverLocationHtml = receiverPlace ? `<div class="receipt-row"><span class="label">To Location:</span><span class="value">${receiverPlace}</span></div>` : '';
    // Only show commission rows that carry a value; an exchange has none.
    const agentCommissionHtml = n2(transaction.agentCommission) > 0
      ? `<tr><td>Agent Commission (${n2(transaction.agentCommissionPercent)}%)</td><td class="amount-cell">${money(transaction.agentCommission, curCode)}</td></tr>`
      : '';
    const companyCommissionHtml = n2(transaction.companyCommission) > 0
      ? `<tr><td>Company Commission (${n2(transaction.companyCommissionPercent)}%)</td><td class="amount-cell">${money(transaction.companyCommission, curCode)}</td></tr>`
      : '';
    const descriptionHtml = transaction.description ? `<div class="receipt-row"><span class="label">Description:</span><span class="value">${transaction.description}</span></div>` : '';
    // Use hidden iframe for printing (works without popup permissions)
    const styles = `
  /* Inline print styles for A4 receipt - match browser display */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { width: 100%; height: 100%; }
  body { font-family: Arial, sans-serif; background: #fff; color: #000; line-height: 1.6; font-size: 11px; }
  .receipt-content { padding: 20px; border: 3px solid #000; margin: 0; background: #fff; }
  .receipt-logo { text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #000; }
  .receipt-logo h1 { font-size: 21.5px; font-weight: bold; color: #000; margin: 5px 0; }
  .receipt-logo-img { height: 46px; width: auto; max-width: 60%; display: block; margin: 0 auto 4px; }
  .receipt-section {
    margin-bottom: 15px;
    page-break-inside: avoid;
    display: block;
    visibility: visible;
  }
  .receipt-section h3 {
    font-size: 11.5px;
    font-weight: bold;
    color: #000;
    text-transform: uppercase;
    margin: 0 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 2px solid #000;
    display: block;
    visibility: visible;
  }
  .receipt-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 11px; color: #000; line-height: 1.5; }
  .receipt-row .label { font-weight: bold; color: #000; flex: 0 0 40%; min-width: 100px; }
  .receipt-row .value { text-align: right; flex: 1; color: #000; margin-left: 10px; word-break: break-word; }
  .receipt-footer { text-align: center; padding-top: 15px; margin-top: 20px; border-top: 2px solid #000; color: #000; font-size: 11px; font-weight: bold; line-height: 1.5; }
  .receipt-footer p { margin: 5px 0; }
  .receipt-table { 
    width: 100%; 
    border-collapse: collapse; 
    margin: 12px 0; 
    border: 2px solid #000; 
    table-layout: fixed;
    display: table;
    visibility: visible;
  }
  .receipt-table th { 
    background: transparent;
    color: #000;
    border-bottom: 1.5pt solid #000;
    padding: 8px 10px; 
    text-align: left; 
    font-weight: bold; 
    font-size: 11px; 
    border: 1px solid #000; 
    line-height: 1.4; 
    display: table-cell;
  }
  .receipt-table td { 
    padding: 8px 10px; 
    border: 1px solid #000; 
    font-size: 11px; 
    color: #000; 
    font-weight: 500; 
    line-height: 1.4; 
    display: table-cell;
    word-wrap: break-word;
  }
  .receipt-table thead { display: table-header-group; }
  .receipt-table tbody { display: table-row-group; }
  .receipt-table tr { display: table-row; }
  .receipt-table .amount-cell { text-align: right; font-weight: bold; }
  .receipt-table tr:nth-child(even) { background: #f9f9f9; }
  /* Emphasis via weight, size and heavy rules — never a background fill,
     which the browser discards when printing. */
  .receipt-table tr.total-row { font-weight: bold; }
  .receipt-table tr.total-row td {
    background: transparent;
    color: #000;
    font-weight: bold;
    font-size: 13px;
    padding: 11px 10px;
    border-top: 2pt solid #000;
    border-bottom: 2pt solid #000;
  }
  .receipt-table tr.total-row td:last-child { font-size: 14px; }
  @page { size: A4; margin: 0.5in; padding: 0; }
  @media print {
    html { margin: 0; padding: 0; }
    body { margin: 0; padding: 0; width: auto; height: auto; }
    .receipt-content { margin: 0; padding: 20px; width: auto; page-break-inside: avoid; }
    .receipt-table { display: table !important; visibility: visible !important; }
    .receipt-table th, .receipt-table td { display: table-cell !important; }
    .receipt-table thead, .receipt-table tbody { display: table-header-group !important; }
    .receipt-table tr { display: table-row !important; }
  }
  `;

    const html = `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${transaction.transactionId}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="receipt-content">
          <div class="receipt-logo"><img src="${logoUrl}" alt="MoneyPay" class="receipt-logo-img" /></div>

          <div class="receipt-section">
            <h3>Receipt Details</h3>
            <div class="receipt-row"><span class="label">Transaction ID:</span><span class="value">${transaction.transactionId}</span></div>
            <div class="receipt-row"><span class="label">Date & Time:</span><span class="value">${formatDate(transaction.createdAt)}</span></div>
            <div class="receipt-row"><span class="label">Transaction Type:</span><span class="value">${getTransactionType(transaction.type)}</span></div>
          </div>

          <div class="receipt-section">
            <h3>Parties</h3>
            <div class="receipt-row"><span class="label">From:</span><span class="value">${transaction.sender?.name || transaction.sender?.phone || 'System'}</span></div>
            ${senderLocationHtml}
            <div class="receipt-row"><span class="label">To:</span><span class="value">${transaction.receiver?.name || transaction.receiver?.phone || 'N/A'}</span></div>
            ${receiverLocationHtml}
          </div>

          <div class="receipt-section">
            <h3>Amount Details</h3>
            <table class="receipt-table">
              <thead>
                <tr><th>Description</th><th class="amount-cell">Amount</th></tr>
              </thead>
              <tbody>
                <tr><td>${isExchange ? 'Amount Converted' : 'Transaction Amount'}</td><td class="amount-cell">${money(transaction.amount, curCode)}</td></tr>
                ${isExchange ? `
                  ${transaction.exchangeRate ? `<tr><td>Rate Applied</td><td class="amount-cell">1 ${curCode} = ${n2(transaction.exchangeRate)} ${toCode}</td></tr>` : ''}
                  ${transaction.exchangeMode ? `<tr><td>Exchange Mode</td><td class="amount-cell">${transaction.exchangeMode === 'buying' ? 'Buying' : 'Selling'}</td></tr>` : ''}
                  <tr class="total-row"><td><strong>RECIPIENT RECEIVES</strong></td><td class="amount-cell"><strong>${money(transaction.convertedAmount ?? transaction.receiverCredit, toCode)}</strong></td></tr>
                ` : `
                  ${agentCommissionHtml}
                  ${companyCommissionHtml}
                  ${hasCommission ? `<tr><td><strong>Total Commission Fee</strong></td><td class="amount-cell"><strong>${money(totalCommission, curCode)}</strong></td></tr>` : ''}
                  <tr class="total-row"><td><strong>TOTAL PAYMENT</strong></td><td class="amount-cell"><strong>${money(n2(transaction.amount) + totalCommission, curCode)}</strong></td></tr>
                `}
              </tbody>
            </table>
          </div>

          <div class="receipt-section">
            <h3>Status</h3>
            <div class="receipt-row"><span class="label">Status:</span><span class="value status-${transaction.status}">${(transaction.status || '').toUpperCase() || 'UNKNOWN'}</span></div>
            ${descriptionHtml}
          </div>

          <div class="receipt-footer"><p>Thank you for using MoneyPay</p><p class="print-instruction">Print this receipt for your records</p></div>
        </div>
      </body>
    </html>`;

    // Create a hidden iframe for printing
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    try {
      let printed = false; // guard to prevent double-printing
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        alert('Could not access iframe for printing. Please try again.');
        document.body.removeChild(iframe);
        return;
      }

      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      console.log('Print iframe content written, HTML length:', html.length);

      // Wait for iframe content to fully load
      iframe.onload = () => {
        console.log('Print iframe loaded successfully');
        setTimeout(() => {
          try {
            if (!printed) {
              printed = true;
              console.log('Attempting to print...');
              iframe.contentWindow?.print();
            }
          } catch (err) {
            console.error('Printing failed:', err);
            // Fallback: try direct print
            try {
              window.print();
            } catch (fallbackErr) {
              console.error('Fallback printing also failed:', fallbackErr);
              alert('Printing failed. Please try using Ctrl+P (Cmd+P on Mac) to print this page.');
            }
          }
          // Remove iframe after short delay to allow print dialog to open
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 500);
        }, 500); // Increased timeout
      };

      // Fallback timeout if onload doesn't fire
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          console.log('Print iframe fallback timeout triggered');
          try {
            if (!printed) {
              printed = true;
              console.log('Attempting fallback print...');
              iframe.contentWindow?.print();
            }
          } catch (err) {
            console.error('Printing failed (timeout fallback):', err);
            // Fallback: try direct print
            try {
              window.print();
            } catch (fallbackErr) {
              console.error('Fallback printing also failed:', fallbackErr);
              alert('Printing failed. Please try using Ctrl+P (Cmd+P on Mac) to print this page.');
            }
          }
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 500);
        }
      }, 3000); // Increased fallback timeout
    } catch (err) {
      console.error('Error setting up iframe print:', err);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getTransactionType = (type) => typeName(type);

  return (
    <div className="print-receipt-overlay" onClick={onClose}>
      <div className="print-receipt-modal" onClick={(e) => e.stopPropagation()}>
        <div className="print-receipt-header">
          <h2><FileText size={18} /> Transaction Receipt</h2>
          <button className="close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="receipt-content">
          <div className="receipt-logo">
            <img src={mpLogo} alt="MoneyPay" className="receipt-logo-img" />
          </div>

          <div className="receipt-section">
            <h3>Receipt Details</h3>
            <div className="receipt-row">
              <span className="label">Transaction ID:</span>
              <span className="value">{transaction.transactionId}</span>
            </div>
            <div className="receipt-row">
              <span className="label">Date & Time:</span>
              <span className="value">{formatDate(transaction.createdAt)}</span>
            </div>
            <div className="receipt-row">
              <span className="label">Transaction Type:</span>
              <span className="value">{getTransactionType(transaction.type)}</span>
            </div>
          </div>

          <div className="receipt-section">
            <h3>Parties</h3>
            <div className="receipt-row">
              <span className="label">From:</span>
              <span className="value">
                {transaction.sender?.name || transaction.sender?.phone || 'System'}
              </span>
            </div>
            {placeLabel(transaction.senderLocation) && (
              <div className="receipt-row">
                <span className="label">From Location:</span>
                <span className="value">{placeLabel(transaction.senderLocation)}</span>
              </div>
            )}
            <div className="receipt-row">
              <span className="label">To:</span>
              <span className="value">
                {transaction.receiver?.name || transaction.receiver?.phone || 'N/A'}
              </span>
            </div>
            {placeLabel(transaction.receiverLocation) && (
              <div className="receipt-row">
                <span className="label">To Location:</span>
                <span className="value">{placeLabel(transaction.receiverLocation)}</span>
              </div>
            )}
          </div>

          <div className="receipt-section">
            <h3>Amount Details</h3>
            <table className="receipt-table">
              <thead>
                <tr><th>Description</th><th className="amount-cell">Amount</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>{isExchange ? 'Amount Converted' : 'Transaction Amount'}</td>
                  <td className="amount-cell">{money(transaction.amount, curCode)}</td>
                </tr>

                {isExchange ? (
                  <>
                    {transaction.exchangeRate && (
                      <tr>
                        <td>Rate Applied</td>
                        <td className="amount-cell">1 {curCode} = {n2(transaction.exchangeRate)} {toCode}</td>
                      </tr>
                    )}
                    {transaction.exchangeMode && (
                      <tr>
                        <td>Exchange Mode</td>
                        <td className="amount-cell">{transaction.exchangeMode === 'buying' ? 'Buying' : 'Selling'}</td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td><strong>Recipient Receives</strong></td>
                      <td className="amount-cell"><strong>{money(transaction.convertedAmount ?? transaction.receiverCredit, toCode)}</strong></td>
                    </tr>
                  </>
                ) : (
                  <>
                    {n2(transaction.agentCommission) > 0 && (
                      <tr>
                        <td>Agent Commission ({n2(transaction.agentCommissionPercent)}%)</td>
                        <td className="amount-cell">{money(transaction.agentCommission, curCode)}</td>
                      </tr>
                    )}
                    {n2(transaction.companyCommission) > 0 && (
                      <tr>
                        <td>Company Commission ({n2(transaction.companyCommissionPercent)}%)</td>
                        <td className="amount-cell">{money(transaction.companyCommission, curCode)}</td>
                      </tr>
                    )}
                    {hasCommission && (
                      <tr>
                        <td><strong>Total Commission Fee</strong></td>
                        <td className="amount-cell">{money(totalCommission, curCode)}</td>
                      </tr>
                    )}
                    <tr className="total-row">
                      <td><strong>TOTAL PAYMENT</strong></td>
                      <td className="amount-cell"><strong>{money(n2(transaction.amount) + totalCommission, curCode)}</strong></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          <div className="receipt-section">
            <h3>Status</h3>
            <div className="receipt-row">
              <span className="label">Status:</span>
              <span className={`value status-${transaction.status}`}>
                {transaction.status?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            {transaction.description && (
              <div className="receipt-row">
                <span className="label">Description:</span>
                <span className="value">{transaction.description}</span>
              </div>
            )}
          </div>

          <div className="receipt-footer">
            <p>Thank you for using MoneyPay</p>
            <p className="print-instruction">Print this receipt for your records</p>
          </div>
        </div>

        <div className="print-receipt-actions receipt-actions">
          <button className="btn btn-primary" onClick={handlePrint} title="Print just this receipt">
            <Printer size={14} /> Print receipt
          </button>
          <button className="btn btn-secondary" onClick={() => generateTransactionDocument(transaction)} title="Save as PDF">
            <Download size={14} /> Download PDF
          </button>
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
