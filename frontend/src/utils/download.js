/* ==========================================================================
   Saving a file from the browser.

   Every export gets its own name. Dating a file to the day alone meant a second
   download on the same day arrived as "…(1).csv" or silently replaced the
   first, depending on the browser — bad for a financial record, where two pulls
   under different filters are two different documents rather than a duplicate.

   The timestamp runs to the second and a short random suffix settles the rest,
   so two exports inside the same second still differ.
   ========================================================================== */

const pad = (n) => String(n).padStart(2, '0');

/* Lower-case, hyphenated, safe on every filesystem. Falls back rather than
   returning an empty string when a name is entirely punctuation. */
export const slug = (value, fallback = 'export') =>
  String(value || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || fallback;

export function uniqueFileName(prefix, extension, parts = []) {
  const now = new Date();
  const stamp =
    now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate()) +
    '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
  const unique = Math.random().toString(36).slice(2, 6);
  const middle = parts.filter(Boolean).map((p) => slug(p)).join('-');
  return [prefix, middle, stamp, unique].filter(Boolean).join('-') + '.' + extension;
}

/* Builds the blob, clicks it, and releases the object URL. The anchor is
   removed whatever happens, so a failure part-way through cannot leave one
   stranded in the document. */
export function saveBlob(parts, type, fileName) {
  const url = URL.createObjectURL(new Blob(parts, { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
