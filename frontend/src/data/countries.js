/* Country dialling codes for the phone field.

   Flags are derived from the ISO code rather than shipped as images: each
   letter maps to its Unicode regional indicator, and a pair of those renders
   as a flag. That keeps this a few KB of text with no asset requests, and it
   stays correct if a country is added.

   The list leads with South Sudan and its neighbours — the app's actual user
   base — then covers the rest of Africa and the countries a diaspora account
   is most likely to come from. It is deliberately not the full ISO 3166 set:
   this file sits in the eagerly-loaded auth bundle, so every entry is weight
   on first paint.
*/

export const COUNTRIES = [
  // South Sudan and its neighbours
  { code: 'SS', dial: '+211', name: 'South Sudan' },
  { code: 'SD', dial: '+249', name: 'Sudan' },
  { code: 'UG', dial: '+256', name: 'Uganda' },
  { code: 'KE', dial: '+254', name: 'Kenya' },
  { code: 'ET', dial: '+251', name: 'Ethiopia' },
  { code: 'CD', dial: '+243', name: 'DR Congo' },
  { code: 'CF', dial: '+236', name: 'Central African Republic' },

  // rest of East and Horn of Africa
  { code: 'TZ', dial: '+255', name: 'Tanzania' },
  { code: 'RW', dial: '+250', name: 'Rwanda' },
  { code: 'BI', dial: '+257', name: 'Burundi' },
  { code: 'SO', dial: '+252', name: 'Somalia' },
  { code: 'ER', dial: '+291', name: 'Eritrea' },
  { code: 'DJ', dial: '+253', name: 'Djibouti' },

  // north, west and southern Africa
  { code: 'EG', dial: '+20',  name: 'Egypt' },
  { code: 'LY', dial: '+218', name: 'Libya' },
  { code: 'TD', dial: '+235', name: 'Chad' },
  { code: 'NG', dial: '+234', name: 'Nigeria' },
  { code: 'GH', dial: '+233', name: 'Ghana' },
  { code: 'CM', dial: '+237', name: 'Cameroon' },
  { code: 'ZA', dial: '+27',  name: 'South Africa' },
  { code: 'ZM', dial: '+260', name: 'Zambia' },
  { code: 'ZW', dial: '+263', name: 'Zimbabwe' },
  { code: 'MW', dial: '+265', name: 'Malawi' },
  { code: 'MZ', dial: '+258', name: 'Mozambique' },
  { code: 'AO', dial: '+244', name: 'Angola' },
  { code: 'MA', dial: '+212', name: 'Morocco' },
  { code: 'DZ', dial: '+213', name: 'Algeria' },
  { code: 'TN', dial: '+216', name: 'Tunisia' },

  // common diaspora destinations
  { code: 'AE', dial: '+971', name: 'United Arab Emirates' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { code: 'QA', dial: '+974', name: 'Qatar' },
  { code: 'GB', dial: '+44',  name: 'United Kingdom' },
  { code: 'US', dial: '+1',   name: 'United States' },
  { code: 'CA', dial: '+1',   name: 'Canada' },
  { code: 'AU', dial: '+61',  name: 'Australia' },
  { code: 'DE', dial: '+49',  name: 'Germany' },
  { code: 'FR', dial: '+33',  name: 'France' },
  { code: 'NL', dial: '+31',  name: 'Netherlands' },
  { code: 'SE', dial: '+46',  name: 'Sweden' },
  { code: 'NO', dial: '+47',  name: 'Norway' },
  { code: 'IN', dial: '+91',  name: 'India' },
  { code: 'CN', dial: '+86',  name: 'China' },
  { code: 'TR', dial: '+90',  name: 'Turkey' },
];

export const DEFAULT_COUNTRY = 'SS';

/* 'SS' -> 🇸🇸. 0x1F1E6 is the regional indicator for 'A', so the offset from
   'A' gives each letter its indicator. Returns '' for anything that is not a
   two-letter code, so a bad entry renders nothing rather than mojibake. */
export function flagOf(code) {
  if (typeof code !== 'string' || code.length !== 2) return '';
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '';
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/* Longest dial code first, so '+1' does not shadow '+211' when matching. */
export function countryFromPhone(phone) {
  if (!phone) return null;
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  return sorted.find((c) => phone.startsWith(c.dial)) || null;
}
