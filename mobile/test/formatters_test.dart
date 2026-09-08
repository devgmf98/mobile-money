import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/core/utils/formatters.dart';

void main() {
  _thousandsTests();
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


/* Grouped money fields. The separators live in the field's own text, so the
   pair that matters is the formatter that puts them there and the parse that
   takes them back out -- a mismatch would read a typed million as zero. */
void _thousandsTests() {
  TextEditingValue typed(String text) => TextEditingValue(
    text: text,
    selection: TextSelection.collapsed(offset: text.length),
  );

  String format(String text) =>
      const ThousandsFormatter()
          .formatEditUpdate(const TextEditingValue(), typed(text))
          .text;

  group('ThousandsFormatter', () {
    test('groups whole amounts', () {
      expect(format('1000000'), '1,000,000');
      expect(format('1000'), '1,000');
      expect(format('999'), '999');
      expect(format(''), '');
    });

    test('keeps a decimal, to two places', () {
      expect(format('1000000.5'), '1,000,000.5');
      expect(format('1000000.50'), '1,000,000.50');
      expect(format('1000.999'), '1,000.99');
      expect(format('1000.'), '1,000.');
    });

    test('is stable when its own output is fed back in', () {
      expect(format('1,000,000.50'), '1,000,000.50');
    });

    test('groups as each digit arrives', () {
      final trail = <String>[];
      var text = '';
      for (final ch in '1000000'.split('')) {
        text = format(text + ch);
        trail.add(text);
      }
      expect(trail, [
        '1', '10', '100', '1,000', '10,000', '100,000', '1,000,000',
      ]);
    });
  });

  group('Fmt.parseAmount', () {
    test('reads back what the formatter wrote', () {
      expect(Fmt.parseAmount('1,000,000.50'), 1000000.50);
      expect(Fmt.parseAmount('1,000'), 1000);
      expect(Fmt.parseAmount('999.99'), 999.99);
    });

    test('is 0 for nothing, rather than null', () {
      expect(Fmt.parseAmount(''), 0);
      expect(Fmt.parseAmount(null), 0);
    });

    test('double.tryParse would have failed on these', () {
      expect(double.tryParse('1,000,000.50'), isNull);
      expect(Fmt.parseAmount('1,000,000.50'), 1000000.50);
    });
  });
}
