/* ==========================================================================
   The report as a spreadsheet Excel opens correctly.

   A .csv cannot do this. It is plain text: no column widths, no number
   formats, no way to say "this 12-digit string is a phone number and not a
   quantity". Every Excel complaint against the CSV export — 2.11912E+11 in the
   phone column, columns too narrow to read — is a limit of the format, not of
   how the file was written.

   So this emits an HTML workbook under the Excel content type, the same
   technique the Word statement uses. Excel reads it as a sheet and honours:
     - a width per column, measured from the widest thing in it
     - mso-number-format, so a phone stays text and money keeps two decimals
     - real numeric cells, which still sum and sort
   No library, nothing to install.

   Columns declare their own type, so nothing has to be inferred from the value
   at write time -- which is how a phone number came to be treated as a
   quantity in the first place.
   ========================================================================== */

import { saveBlob, uniqueFileName } from './download';

const esc = (v) =>
  String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* Excel's own format codes. `\@` is its "treat as text" marker -- the one thing
   that stops a long digit string collapsing into scientific notation. */
const FORMATS = {
  text: "\\@",
  id: "\\@",
  number: '#,##0.00',
  count: '#,##0',
  date: 'dd\\ mmm\\ yyyy',
};

/* Width from the widest cell in the column, header included.

   Roughly 5.6pt per character at the sheet's font, clamped so a short column
   is still clickable and one long email does not push the sheet off screen.
   This is what "fit to text" means for a file: the widths travel with it, so
   nobody has to select-all and double-click a column border on opening. */
function widthFor(column, rows) {
  const lengths = rows.map((r) => String(column.value(r) ?? '').length);
  const widest = Math.max(column.label.length, ...(lengths.length ? lengths : [0]));
  return Math.min(230, Math.max(58, Math.round(widest * 5.6) + 16));
}

export function buildReportSheet({ columns, rows, title, subtitle }) {
  const widths = columns.map((c) => widthFor(c, rows));

  const headCells = columns
    .map((c, i) => '<th style="width:' + widths[i] + 'pt">' + esc(c.label) + '</th>')
    .join('');

  const bodyRows = rows.map((r) => '<tr>' + columns.map((c) => {
    const raw = c.value(r);
    /* Single quotes around the format, not double. A double-quoted value inside
       a double-quoted style attribute closes the attribute at the first inner
       quote, so the directive is cut off and Excel falls back to guessing —
       which puts the phone column straight back into scientific notation. */
    const style = "mso-number-format:'" + FORMATS[c.type] + "';" +
      (c.type === 'number' || c.type === 'count' ? 'text-align:right;' : '');
    /* A blank numeric cell stays genuinely empty rather than becoming a zero --
       no activity in a currency is not the same as nought of it. */
    if (raw === '' || raw == null) return '<td style="' + style + '"></td>';
    return '<td style="' + style + '">' + esc(raw) + '</td>';
  }).join('') + '</tr>').join('');

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"/>
<title>${esc(title)}</title>
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Report</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/><x:FreezePanes/><x:FrozenNoSplit/>
<x:SplitHorizontal>1</x:SplitHorizontal><x:TopRowBottomPane>1</x:TopRowBottomPane>
<x:ActivePane>2</x:ActivePane></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
  th { background: #E8F7F0; color: #005C2E; font-weight: bold; text-align: left;
       border: 1px solid #CDEBDD; padding: 5px 7px; white-space: nowrap; }
  td { border: 1px solid #E3EAE7; padding: 4px 7px; vertical-align: top; }
</style>
</head>
<body>
  <table>
    <thead><tr>${headCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
  ${subtitle ? '<p style="font-family:Calibri;font-size:9pt;color:#5B6B66">' + esc(subtitle) + '</p>' : ''}
</body>
</html>`;
}

export function downloadReportSheet(spec, nameParts = []) {
  saveBlob(
    ['﻿', buildReportSheet(spec)],
    'application/vnd.ms-excel',
    uniqueFileName('moneypay-report', 'xls', nameParts),
  );
}
