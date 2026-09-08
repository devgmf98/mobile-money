/* Grouped digits in the box you type into.

   `<input type="number">` cannot show separators -- a browser will not render
   "1,000,000.00" in one, and setting a value with commas silently blanks it.
   So the money fields are text inputs with inputMode="decimal", which still
   brings up the numeric keypad on a phone, and these two functions sit between
   what is displayed and what is stored.

   State stays the bare string ("1000000.5"), so every parseFloat around it
   keeps working untouched; only the rendered value is grouped. */

/* Everything typed, reduced to a number the rest of the page can parse.

   Anything that is not a digit or a dot goes -- commas as they are re-added on
   display, and stray letters from a keypad. A second dot is dropped rather
   than truncating there, so "1.5.2" reads as 1.52 instead of collapsing to
   1.5, and the fraction is held to two places. */
export function stripGroups(text) {
  const cleaned = String(text ?? '').replace(/[^0-9.]/g, '');
  if (!cleaned) return '';

  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole;

  const fraction = rest.join('').slice(0, 2);
  // The trailing dot is kept: it is a number half-typed, not an invalid one.
  return `${whole}.${fraction}`;
}

/* The stored string with thousands separators, for display.

   A lone or trailing dot survives, so typing "1000." does not have the dot
   yanked back out from under the cursor. */
export function groupAmount(raw) {
  const value = String(raw ?? '');
  if (!value) return '';

  const [whole, fraction] = value.split('.');
  const grouped = whole ? Number(whole).toLocaleString('en-US') : '';

  if (fraction === undefined) return grouped;
  return `${grouped || '0'}.${fraction}`;
}

/* What to show in a money box, straight from whatever the state holds. */
export const amountValue = (raw) => groupAmount(stripGroups(raw));

/* Handler body for a grouped money input: hands the caller the bare string. */
export const onAmountInput = (setter) => (event) => setter(stripGroups(event.target.value));
