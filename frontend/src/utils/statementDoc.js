/* ==========================================================================
   Statement / invoice as a Word document.

   Word opens an HTML document with an `application/msword` type and a `.doc`
   extension, keeping tables, colours and headings intact. That is what this
   builds — no library, nothing to install, and the file survives being emailed
   and reopened.

   The alternative, a real .docx, is a zip of XML parts and would mean adding a
   dependency to produce a file Word renders no better than this one.

   Money is written per currency and never added across currencies: there is no
   cross-rate at statement time, so a single figure spanning SSP, USD and UGX
   would be arithmetic on unlike units.
   ========================================================================== */

import { saveBlob, uniqueFileName } from './download';

const TYPE_LABELS = {
  transfer: 'Transfer',
  topup: 'Top-up',
  withdrawal: 'Withdrawal',
  user_withdraw: 'User withdrawal',
  agent_deposit: 'Agent deposit',
  agent_cash_out_money: 'Agent cash out',
  admin_push: 'Refunded by admin',
  admin_state_push: 'State push',
  money_exchange: 'Money exchange',
};

const ROLE_LABELS = { user: 'User', agent: 'Agent', admin: 'Admin', 'sub-admin': 'Sub-admin' };

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const day = (v) => {
  const d = v ? new Date(v) : null;
  return !d || isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const moment = (v) => {
  const d = v ? new Date(v) : null;
  return !d || isNaN(d)
    ? '—'
    : d.toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
};

/* A per-currency list on one line, or a dash. */
const perCurrency = (totals) =>
  !totals || !totals.length
    ? '&#8212;'
    : totals.map((t) => esc(money(t.amount)) + ' <span class="cur">' + esc(t.currency) + '</span>').join('<br/>');

export function buildStatementDoc(data) {
  const p = data.person || {};
  const t = data.totals || {};
  const txns = data.transactions || [];

  const periodLabel = (() => {
    const { from, to, range } = data.period || {};
    if (from || to) return day(from) + ' to ' + day(to);
    const named = { today: 'Today', week: 'Last 7 days', month: 'Last month', year: 'Last year' };
    return named[range] || 'All time';
  })();

  /* The six terms, then the figure they add up to. Laid out in the order the
     calculation states them so the arithmetic can be followed down the page. */
  const rows = [
    ['Total Amount Sent', t.sent, '+'],
    ['Commission', t.commission, '+'],
    ['Total Top-up Amount', t.topup, '+'],
    ['Total Amount Received', t.received, '&#8722;'],
    ['Total Exchange Amount', t.exchanged, '&#8722;'],
    ['Total Exchange Amount Converted', t.converted, '+'],
    ['Total Cash-out Amount', t.cashOut, '&#8722;'],
  ];

  const termRows = rows.map(([label, totals, sign]) => `
    <tr>
      <td class="sign">${sign}</td>
      <td class="term"><b>${esc(label)}</b></td>
      <td class="num">${perCurrency(totals)}</td>
    </tr>`).join('');

  /* One row, however many currencies. Repeating the label per currency read as
     though there were several different outstanding amounts rather than one
     figure that happens to be denominated in more than one currency. */
  const outstanding = t.outstanding || [];
  const outstandingRow = `
    <tr class="total">
      <td></td>
      <td class="term">Total Outstanding Amount</td>
      <td class="num">${
        outstanding.length
          ? outstanding.map((o) =>
              '<span class="' + (o.amount < 0 ? 'neg' : '') + '">' +
              esc(money(o.amount)) + ' <span class="cur">' + esc(o.currency) + '</span></span>').join('<br/>')
          : '&#8212;'
      }</td>
    </tr>`;

  /* Exchanges read as pairs — the currency taken in and the one handed back —
     because one number cannot say what an exchange was. */
  const exchanges = t.exchanges || [];
  const exchangeBlock = exchanges.length
    ? `
    <h2>Money exchanges</h2>
    <table class="grid">
      <tr><th>Pair</th><th class="num">Amount exchanged</th><th class="num">Converted to</th><th class="num">Count</th></tr>
      ${exchanges.map((x) => `
        <tr>
          <td><b>${esc(x.from)}</b>${x.to ? ' &#8594; <b>' + esc(x.to) + '</b>' : ''}</td>
          <td class="num">${esc(money(x.amount))} <span class="cur">${esc(x.from)}</span></td>
          <td class="num">${x.to ? esc(money(x.converted)) + ' <span class="cur">' + esc(x.to) + '</span>' : '&#8212;'}</td>
          <td class="num">${x.count}</td>
        </tr>`).join('')}
    </table>`
    : '';

  const txnRows = txns.length
    ? txns.map((x) => `
      <tr>
        <td class="mono">${esc(x.transactionId || x.id)}</td>
        <td>${esc(moment(x.createdAt))}</td>
        <td>${esc(TYPE_LABELS[x.type] || x.type)}</td>
        <td>${esc(x.direction === 'out' ? 'Sent' : x.direction === 'in' ? 'Received' : 'Settled')}</td>
        <td class="num">${esc(money(x.amount))} <span class="cur">${esc(x.currencyCode)}</span>${
          x.toCurrencyCode && x.convertedAmount != null
            ? '<br/><span class="note">&#8594; ' + esc(money(x.convertedAmount)) + ' ' + esc(x.toCurrencyCode) + '</span>'
            : ''
        }</td>
        <td class="num">${x.commission ? esc(money(x.commission)) : x.agentCommission ? esc(money(x.agentCommission)) : '&#8212;'}</td>
        <td>${esc([x.fromStateName, x.toStateName].filter(Boolean).join(' → ')) || '&#8212;'}</td>
        <td class="st st-${esc(x.status)}">${esc(x.status)}</td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="empty">No transactions in this period.</td></tr>';

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>Statement — ${esc(p.name || p.email)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page { size: A4 landscape; margin: 1.4cm; }
  body { font-family: Calibri, Arial, sans-serif; font-size: 10pt; color: #16302B; }
  h1 { font-size: 20pt; margin: 0 0 2pt; color: #005C2E; }
  h2 { font-size: 12pt; margin: 18pt 0 6pt; color: #005C2E;
       border-bottom: 1px solid #CDEBDD; padding-bottom: 3pt; }
  .sub { color: #5B6B66; font-size: 9pt; margin: 0; }
  table { border-collapse: collapse; width: 100%; }
  .meta td { padding: 2pt 10pt 2pt 0; font-size: 9.5pt; vertical-align: top; }
  .meta .k { color: #5B6B66; width: 90pt; }
  .calc td { padding: 5pt 6pt; border-bottom: 1px solid #E3EAE7; vertical-align: top; }
  .calc .sign { width: 18pt; color: #5B6B66; font-weight: bold; text-align: center; }
  .calc .term { }
  .note { color: #5B6B66; font-weight: normal; }
  .cur { color: #5B6B66; font-size: 8pt; }
  .num { text-align: right; white-space: nowrap; }
  .calc .total td { border-top: 2px solid #005C2E; border-bottom: none;
                    background: #E8F7F0; font-weight: bold; font-size: 11pt; padding-top: 7pt; }
  .neg { color: #C0392B; }
  .grid th { background: #E8F7F0; color: #005C2E; text-align: left;
             padding: 5pt 6pt; border: 1px solid #CDEBDD; font-size: 9pt; }
  .grid td { padding: 4pt 6pt; border: 1px solid #E3EAE7; font-size: 9pt; vertical-align: top; }
  .mono { font-family: Consolas, 'Courier New', monospace; font-size: 8.5pt; }
  .st { text-transform: capitalize; font-weight: bold; font-size: 8.5pt; }
  .st-completed { color: #0F7A43; }
  .st-pending { color: #B45309; }
  .st-cancelled, .st-failed { color: #B42318; }
  .empty { text-align: center; color: #5B6B66; padding: 12pt; }
  .foot { margin-top: 16pt; padding-top: 6pt; border-top: 1px solid #E3EAE7;
          color: #5B6B66; font-size: 8.5pt; }
</style>
</head>
<body>
  <h1>MoneyPay</h1>
  <p class="sub">Statement of account</p>

  <h2>Account</h2>
  <table class="meta">
    <tr><td class="k">Name</td><td><b>${esc(p.name || '—')}</b></td>
        <td class="k">Role</td><td>${esc(ROLE_LABELS[p.role] || p.role || '—')}</td></tr>
    <tr><td class="k">Email</td><td>${esc(p.email || '—')}</td>
        <td class="k">Destination</td><td>${esc(p.destination || '—')}</td></tr>
    <tr><td class="k">Phone</td><td>${esc(p.phone || '—')}</td>
        <td class="k">Reference</td><td>${esc(p.reference || '—')}</td></tr>
    <tr><td class="k">Joined</td><td>${esc(day(p.joined))}</td>
        <td class="k">Standing</td><td>${p.isSuspended ? 'Suspended' : 'Active'}${p.isVerified ? '' : ', unverified'}</td></tr>
    <tr><td class="k">Period</td><td colspan="3"><b>${esc(periodLabel)}</b></td></tr>
  </table>

  <h2>Summary</h2>
  <table class="calc">
    ${termRows}
    ${outstandingRow}
  </table>
  <p class="sub" style="margin-top:6pt;">
    Totals count <b>completed</b> transactions only, and each currency is netted on
    its own &#8212; figures are never added across currencies.
  </p>

  ${exchangeBlock}

  <h2>Transactions <span class="note">(${txns.length} record${txns.length === 1 ? '' : 's'}, all statuses)</span></h2>
  <table class="grid">
    <tr>
      <th>Reference</th><th>Date</th><th>Type</th><th>Side</th>
      <th class="num">Amount</th><th class="num">Commission</th><th>Route</th><th>Status</th>
    </tr>
    ${txnRows}
  </table>

  <p class="foot">
    Generated ${esc(moment(new Date()))} &#183; MoneyPay &#183;
    The summary above counts completed transactions only, while this list shows every
    record in the period, so the two will not tie out where anything is pending or cancelled.
  </p>
</body>
</html>`;

  return html;
}

/* Hands the document to the browser as a download, under a name no other
   export will collide with. The leading BOM is what tells Word the file is
   UTF-8, without which the accented characters and arrows arrive as mojibake. */
export function downloadStatementDoc(data) {
  const html = buildStatementDoc(data);
  const person = data?.person?.name || data?.person?.email || 'statement';
  saveBlob(['﻿', html], 'application/msword',
    uniqueFileName('moneypay-statement', 'doc', [person]));
}
