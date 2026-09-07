import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/core/utils/phone.dart';

/// The app's phone handling has to agree with the server's `phoneVariants`
/// helper, or the same person resolves on one screen and not another. These
/// cases are taken straight from the forms that helper was written for.
void main() {
  group('Phone.normalise', () {
    test('keeps a number already in international form', () {
      expect(Phone.normalise('+211912345002'), '+211912345002');
    });

    test('adds the plus to a bare country code', () {
      expect(Phone.normalise('211912345002'), '+211912345002');
    });

    test('drops the national trunk zero before adding the country code', () {
      // The case the server helper calls out by name: locally people write
      // 0912345002 for +211912345002.
      expect(Phone.normalise('0912345002'), '+211912345002');
    });

    test('expands a bare local number', () {
      expect(Phone.normalise('912345002'), '+211912345002');
    });

    test('ignores spaces, dashes and brackets', () {
      expect(Phone.normalise('+211 (912) 345-002'), '+211912345002');
    });

    test('returns empty for input with no digits', () {
      expect(Phone.normalise('   '), '');
      expect(Phone.normalise('not a number'), '');
    });

    test('does not turn a lone zero into a country code', () {
      expect(Phone.normalise('0'), '');
    });
  });

  group('Phone.sameNumber', () {
    test('matches the same account written four different ways', () {
      const forms = [
        '+211912345002',
        '211912345002',
        '0912345002',
        '912345002',
      ];
      for (final left in forms) {
        for (final right in forms) {
          expect(
            Phone.sameNumber(left, right),
            isTrue,
            reason: '$left should equal $right',
          );
        }
      }
    });

    test('separates different numbers', () {
      expect(Phone.sameNumber('0912345002', '0912345003'), isFalse);
    });

    test('is false when either side is missing', () {
      expect(Phone.sameNumber(null, '0912345002'), isFalse);
      expect(Phone.sameNumber('0912345002', null), isFalse);
      expect(Phone.sameNumber('', '0912345002'), isFalse);
    });
  });

  group('Phone.pretty', () {
    test('groups the subscriber digits in threes', () {
      expect(Phone.pretty('0912345002'), '+211 912 345 002');
    });

    test('handles a length that does not divide evenly', () {
      expect(Phone.pretty('+21191234500'), '+211 912 345 00');
    });

    test('returns empty rather than a bare country code', () {
      expect(Phone.pretty(''), '');
      expect(Phone.pretty(null), '');
    });
  });

  group('Phone.looksValid', () {
    test('accepts a nine-digit local number in any form', () {
      expect(Phone.looksValid('0912345002'), isTrue);
      expect(Phone.looksValid('+211912345002'), isTrue);
    });

    test('rejects something far too short', () {
      expect(Phone.looksValid('12345'), isFalse);
      expect(Phone.looksValid(''), isFalse);
    });
  });
}
