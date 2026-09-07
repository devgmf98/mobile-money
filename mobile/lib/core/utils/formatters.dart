import 'package:intl/intl.dart';

import '../config/env.dart';

/// Money, dates and phone numbers, formatted the way the design shows them.
class Fmt {
  const Fmt._();

  static final NumberFormat _money = NumberFormat('#,##0.00', 'en_US');
  static final NumberFormat _plain = NumberFormat('#,##0.##', 'en_US');
  static final DateFormat _time = DateFormat('hh:mm a');
  static final DateFormat _dayMonth = DateFormat('d MMM yyyy');
  static final DateFormat _full = DateFormat('d MMM yyyy, hh:mm a');

  /// `SSP 125,750.00` — the headline form used on the balance card and in
  /// transaction rows.
  static String money(num? amount) =>
      '${Env.currency} ${_money.format(amount ?? 0)}';

  /// The same figure without the currency, for places that label it separately.
  static String amount(num? value) => _money.format(value ?? 0);

  /// Drops trailing zeros — used for percentages and quick-amount chips.
  static String compact(num? value) => _plain.format(value ?? 0);

  /// A signed amount, coloured by the caller: `+ SSP 12,000.00`.
  static String signedMoney(num amount, {required bool incoming}) =>
      '${incoming ? '+' : '-'} ${money(amount.abs())}';

  static String percent(num? value) => '${_plain.format(value ?? 0)}%';

  static String time(DateTime when) => _time.format(when.toLocal());

  static String date(DateTime when) => _dayMonth.format(when.toLocal());

  static String dateTime(DateTime when) => _full.format(when.toLocal());

  /// The heading above a group of transactions: Today, Yesterday, or the date.
  static String dayHeading(DateTime when) {
    final local = DateTime(
      when.toLocal().year,
      when.toLocal().month,
      when.toLocal().day,
    );
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final difference = today.difference(local).inDays;

    if (difference == 0) return 'Today';
    if (difference == 1) return 'Yesterday';
    if (difference < 7) return DateFormat('EEEE').format(local);
    return _dayMonth.format(local);
  }

  /// The account number as a bank prints one: digits only, in groups of four.
  ///
  /// `+211912399537` reads as `2119 1239 9537`. The country-code plus is
  /// dropped because it marks the value as a phone number, which is the
  /// opposite of the intent here. Matches `accountCode` in the web app's
  /// UserDashboard so the same account reads identically in both.
  static String accountCode(String? phone) {
    if (phone == null || phone.isEmpty) return '—';
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return phone;

    final groups = <String>[];
    for (var i = 0; i < digits.length; i += 4) {
      groups.add(digits.substring(i, (i + 4).clamp(0, digits.length)));
    }
    return groups.join(' ');
  }

  /// First name only, for the dashboard greeting.
  static String firstName(String? fullName) {
    final trimmed = (fullName ?? '').trim();
    if (trimmed.isEmpty) return 'there';
    return trimmed.split(RegExp(r'\s+')).first;
  }

  /// Up to two letters for the avatar fallback.
  static String initials(String? fullName) {
    final parts = (fullName ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return '${parts.first.substring(0, 1)}${parts.last.substring(0, 1)}'
        .toUpperCase();
  }
}
