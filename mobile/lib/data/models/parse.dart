/// Tolerant JSON readers.
///
/// The API is Sequelize over MySQL, and mysql2 returns every DECIMAL column as
/// a *string* — a balance comes back as `"125750.00"`, an amount as `"5000.00"`.
/// Ids are sometimes numbers and sometimes strings depending on the endpoint.
/// Parsing defensively here keeps that untidiness out of every screen.
class P {
  const P._();

  static double toDouble(Object? value, [double fallback = 0]) {
    if (value == null) return fallback;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? fallback;
  }

  static int toInt(Object? value, [int fallback = 0]) {
    if (value == null) return fallback;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? fallback;
  }

  static int? toIntOrNull(Object? value) {
    if (value == null) return null;
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString());
  }

  static bool toBool(Object? value, [bool fallback = false]) {
    if (value == null) return fallback;
    if (value is bool) return value;
    if (value is num) return value != 0;
    final text = value.toString().toLowerCase();
    if (text == 'true' || text == '1') return true;
    if (text == 'false' || text == '0') return false;
    return fallback;
  }

  static String toText(Object? value, [String fallback = '']) {
    if (value == null) return fallback;
    final text = value.toString();
    return text.isEmpty ? fallback : text;
  }

  static String? toTextOrNull(Object? value) {
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  /// Timestamps arrive as ISO-8601 strings. A row that somehow lacks one still
  /// has to render, so an unparseable date falls back to now rather than
  /// throwing halfway down a list.
  static DateTime toDate(Object? value) {
    if (value is DateTime) return value;
    final parsed = DateTime.tryParse(value?.toString() ?? '');
    return parsed ?? DateTime.now();
  }

  static DateTime? toDateOrNull(Object? value) {
    if (value is DateTime) return value;
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }

  static Map<String, dynamic>? toMap(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.map((k, v) => MapEntry(k.toString(), v));
    return null;
  }

  /// List endpoints sometimes return a bare array and sometimes an object
  /// wrapping one (`{ requests: [...] }`), so callers name the key they expect.
  static List<Map<String, dynamic>> toList(Object? value, {String? key}) {
    Object? source = value;
    if (source is Map && key != null) source = source[key];
    if (source is! List) return const [];

    return source
        .map(toMap)
        .whereType<Map<String, dynamic>>()
        .toList(growable: false);
  }
}
