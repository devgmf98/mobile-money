import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/core/utils/formatters.dart';

void main() {
  group('Fmt.money', () {
    test('groups thousands and always shows two places', () {
      expect(Fmt.money(125750), 'SSP 125,750.00');
      expect(Fmt.money(5000.5), 'SSP 5,000.50');
      expect(Fmt.money(0), 'SSP 0.00');
    });

    test('treats a missing amount as zero rather than blank', () {
      expect(Fmt.money(null), 'SSP 0.00');
    });
  });

  group('Fmt.signedMoney', () {
    test('signs by direction and never shows a double negative', () {
      expect(Fmt.signedMoney(5000, incoming: false), '- SSP 5,000.00');
      expect(Fmt.signedMoney(12000, incoming: true), '+ SSP 12,000.00');
      expect(Fmt.signedMoney(-5000, incoming: false), '- SSP 5,000.00');
    });
  });

  group('Fmt.dayHeading', () {
    test('names today and yesterday', () {
      final now = DateTime.now();
      expect(Fmt.dayHeading(now), 'Today');
      expect(
        Fmt.dayHeading(now.subtract(const Duration(days: 1))),
        'Yesterday',
      );
    });

    test('falls back to a date for anything older than a week', () {
      final old = DateTime(2026, 1, 15);
      expect(Fmt.dayHeading(old), '15 Jan 2026');
    });
  });

  group('Fmt.firstName', () {
    test('takes the first word', () {
      expect(Fmt.firstName('John Doe'), 'John');
      expect(Fmt.firstName('  Mary  James  '), 'Mary');
    });

    test('greets someone with no name on file without an empty gap', () {
      expect(Fmt.firstName(null), 'there');
      expect(Fmt.firstName('   '), 'there');
    });
  });

  group('Fmt.initials', () {
    test('takes the first and last initial', () {
      expect(Fmt.initials('John Doe'), 'JD');
      expect(Fmt.initials('Mary Anne James'), 'MJ');
      expect(Fmt.initials('Prince'), 'P');
    });

    test('never returns an empty avatar', () {
      expect(Fmt.initials(null), '?');
      expect(Fmt.initials(''), '?');
    });
  });

  group('Fmt.percent', () {
    test('drops trailing zeros', () {
      expect(Fmt.percent(2), '2%');
      expect(Fmt.percent(1.5), '1.5%');
      expect(Fmt.percent(0), '0%');
    });
  });
}
