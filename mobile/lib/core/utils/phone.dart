import '../config/env.dart';

/// Phone numbers are stored inconsistently on the server — `+211…`, `211…`,
/// `0…` and bare local forms all exist in the users table. The backend copes by
/// trying a set of variants on every lookup (see `backend/utils/helpers.js`),
/// and the app mirrors that logic so what it displays and what it sends match
/// what the server will actually resolve.
class Phone {
  const Phone._();

  /// Strips everything that is not a digit, keeping a leading `+`.
  static String digitsOnly(String raw) {
    final trimmed = raw.trim();
    if (trimmed.startsWith('+')) {
      return '+${trimmed.substring(1).replaceAll(RegExp(r'\D'), '')}';
    }
    return trimmed.replaceAll(RegExp(r'\D'), '');
  }

  /// The canonical `+211…` form, for display and for sending to the API.
  ///
  /// Mirrors the server's variant rules: the national trunk zero comes off
  /// before the country code goes on, so `0912345002` and `+211912345002` are
  /// understood as the same person.
  static String normalise(String raw) {
    var digits = digitsOnly(raw).replaceAll('+', '');
    if (digits.isEmpty) return '';

    if (digits.startsWith('211')) {
      return '${Env.countryCode}${digits.substring(3)}';
    }

    digits = digits.replaceFirst(RegExp(r'^0+'), '');
    if (digits.isEmpty) return '';

    return '${Env.countryCode}$digits';
  }

  /// Groups the subscriber part for reading: `+211 912 345 002`.
  static String pretty(String? raw) {
    final normalised = normalise(raw ?? '');
    if (normalised.isEmpty) return '';

    final local = normalised.substring(Env.countryCode.length);
    final buffer = StringBuffer(Env.countryCode);
    for (var i = 0; i < local.length; i += 3) {
      buffer.write(' ');
      buffer.write(local.substring(i, (i + 3).clamp(0, local.length)));
    }
    return buffer.toString();
  }

  /// South Sudanese mobile numbers are nine digits after the country code.
  /// Kept lenient — the server is the authority on whether an account exists,
  /// and refusing a number the server would have accepted is the worse failure.
  static bool looksValid(String raw) {
    final local = normalise(raw).replaceFirst(Env.countryCode, '');
    return local.length >= 8 && local.length <= 12;
  }

  /// Builds a full international number from a chosen dial code and the local
  /// part typed beside it.
  ///
  /// The national trunk zero comes off: people write their own number the way
  /// they dial it at home, and `0912345002` under a `+211` code means
  /// `+211912345002`, not `+2110912345002`.
  static String compose(String dial, String local) {
    final digits = local
        .replaceAll(RegExp(r'\D'), '')
        .replaceFirst(RegExp(r'^0+'), '');
    if (digits.isEmpty) return '';
    return '$dial$digits';
  }

  /// Whether the local part alone looks like a subscriber number. Kept lenient
  /// - national number lengths vary widely, and the server is the authority on
  /// whether an account can be created.
  static bool looksValidLocal(String local) {
    final digits = local
        .replaceAll(RegExp(r'\D'), '')
        .replaceFirst(RegExp(r'^0+'), '');
    return digits.length >= 6 && digits.length <= 14;
  }

  /// True when two numbers point at the same account.
  static bool sameNumber(String? a, String? b) {
    if (a == null || b == null) return false;
    final left = normalise(a);
    return left.isNotEmpty && left == normalise(b);
  }
}
