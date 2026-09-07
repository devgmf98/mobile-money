/// Country dialling codes for the phone field.
///
/// The same list, in the same order, as the web app's
/// `frontend/src/data/countries.js` — South Sudan and its neighbours first,
/// then the rest of Africa, then the countries a diaspora account is most
/// likely to come from. Deliberately not the full ISO 3166 set.
class Country {
  const Country({required this.code, required this.dial, required this.name});

  /// ISO 3166-1 alpha-2.
  final String code;

  /// Dialling prefix, including the plus.
  final String dial;

  final String name;

  /// `SS` renders as the South Sudan flag. Each letter maps to its Unicode
  /// regional indicator, and a pair of those is a flag.
  ///
  /// Android has historically shipped without flag glyphs, in which case the
  /// indicators fall back to rendering as the two letters — "SS" — which is
  /// still the country code and still readable. That is why the code is worth
  /// showing even where the flag works.
  String get flag {
    if (code.length != 2) return '';
    return String.fromCharCodes(
      code.toUpperCase().codeUnits.map((c) => 0x1F1E6 + c - 65),
    );
  }

  /// What the picker searches over.
  bool matches(String query) {
    final needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return name.toLowerCase().contains(needle) ||
        code.toLowerCase().contains(needle) ||
        dial.contains(needle.replaceAll('+', ''));
  }
}

class Countries {
  const Countries._();

  static const Country defaultCountry = Country(
    code: 'SS',
    dial: '+211',
    name: 'South Sudan',
  );

  static const List<Country> all = [
    // South Sudan and its neighbours
    defaultCountry,
    Country(code: 'SD', dial: '+249', name: 'Sudan'),
    Country(code: 'UG', dial: '+256', name: 'Uganda'),
    Country(code: 'KE', dial: '+254', name: 'Kenya'),
    Country(code: 'ET', dial: '+251', name: 'Ethiopia'),
    Country(code: 'CD', dial: '+243', name: 'DR Congo'),
    Country(code: 'CF', dial: '+236', name: 'Central African Republic'),

    // rest of East and Horn of Africa
    Country(code: 'TZ', dial: '+255', name: 'Tanzania'),
    Country(code: 'RW', dial: '+250', name: 'Rwanda'),
    Country(code: 'BI', dial: '+257', name: 'Burundi'),
    Country(code: 'SO', dial: '+252', name: 'Somalia'),
    Country(code: 'ER', dial: '+291', name: 'Eritrea'),
    Country(code: 'DJ', dial: '+253', name: 'Djibouti'),

    // north, west and southern Africa
    Country(code: 'EG', dial: '+20', name: 'Egypt'),
    Country(code: 'LY', dial: '+218', name: 'Libya'),
    Country(code: 'TD', dial: '+235', name: 'Chad'),
    Country(code: 'NG', dial: '+234', name: 'Nigeria'),
    Country(code: 'GH', dial: '+233', name: 'Ghana'),
    Country(code: 'CM', dial: '+237', name: 'Cameroon'),
    Country(code: 'ZA', dial: '+27', name: 'South Africa'),
    Country(code: 'ZM', dial: '+260', name: 'Zambia'),
    Country(code: 'ZW', dial: '+263', name: 'Zimbabwe'),
    Country(code: 'MW', dial: '+265', name: 'Malawi'),
    Country(code: 'MZ', dial: '+258', name: 'Mozambique'),
    Country(code: 'AO', dial: '+244', name: 'Angola'),
    Country(code: 'MA', dial: '+212', name: 'Morocco'),
    Country(code: 'DZ', dial: '+213', name: 'Algeria'),
    Country(code: 'TN', dial: '+216', name: 'Tunisia'),

    // common diaspora destinations
    Country(code: 'AE', dial: '+971', name: 'United Arab Emirates'),
    Country(code: 'SA', dial: '+966', name: 'Saudi Arabia'),
    Country(code: 'QA', dial: '+974', name: 'Qatar'),
    Country(code: 'GB', dial: '+44', name: 'United Kingdom'),
    Country(code: 'US', dial: '+1', name: 'United States'),
    Country(code: 'CA', dial: '+1', name: 'Canada'),
    Country(code: 'AU', dial: '+61', name: 'Australia'),
    Country(code: 'DE', dial: '+49', name: 'Germany'),
    Country(code: 'FR', dial: '+33', name: 'France'),
    Country(code: 'NL', dial: '+31', name: 'Netherlands'),
    Country(code: 'SE', dial: '+46', name: 'Sweden'),
    Country(code: 'NO', dial: '+47', name: 'Norway'),
    Country(code: 'IN', dial: '+91', name: 'India'),
    Country(code: 'CN', dial: '+86', name: 'China'),
    Country(code: 'TR', dial: '+90', name: 'Turkey'),
  ];

  /// Which country a full international number belongs to.
  ///
  /// Longest dial code first, so a short prefix never shadows a longer one it
  /// happens to start — `+2` would otherwise claim every `+2xx` number.
  static Country? fromPhone(String? phone) {
    if (phone == null || phone.isEmpty) return null;

    final sorted = [...all]..sort((a, b) => b.dial.length.compareTo(a.dial.length));
    for (final country in sorted) {
      if (phone.startsWith(country.dial)) return country;
    }
    return null;
  }
}
