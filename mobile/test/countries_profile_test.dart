import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/core/utils/countries.dart';
import 'package:moneypay/core/utils/phone.dart';
import 'package:moneypay/core/utils/profile_image.dart';

void main() {
  group('Phone.compose', () {
    test('joins a chosen dial code to the local part', () {
      expect(Phone.compose('+211', '912345002'), '+211912345002');
      expect(Phone.compose('+256', '772123456'), '+256772123456');
    });

    test('drops the national trunk zero', () {
      // People write their own number the way they dial it at home, so a
      // leading 0 under a country code would otherwise be kept literally.
      expect(Phone.compose('+211', '0912345002'), '+211912345002');
      expect(Phone.compose('+44', '07700900123'), '+447700900123');
    });

    test('ignores spacing', () {
      expect(Phone.compose('+211', '912 345 002'), '+211912345002');
    });

    test('returns empty when there is no number', () {
      expect(Phone.compose('+211', ''), '');
      expect(Phone.compose('+211', '0'), '');
      expect(Phone.compose('+211', '   '), '');
    });
  });

  group('Phone.looksValidLocal', () {
    test('accepts subscriber numbers of the lengths countries actually use', () {
      expect(Phone.looksValidLocal('912345002'), isTrue);
      expect(Phone.looksValidLocal('0912345002'), isTrue);
      expect(Phone.looksValidLocal('7700900123'), isTrue);
    });

    test('rejects something far too short', () {
      expect(Phone.looksValidLocal(''), isFalse);
      expect(Phone.looksValidLocal('12345'), isFalse);
    });
  });

  group('Countries', () {
    test('defaults to South Sudan, first in the list', () {
      expect(Countries.defaultCountry.dial, '+211');
      expect(Countries.all.first.code, 'SS');
    });

    test('matches the longest dial code, not the first that fits', () {
      // +1 must not claim a +211 number just by being checked earlier.
      expect(Countries.fromPhone('+211912345002')?.code, 'SS');
      expect(Countries.fromPhone('+256772123456')?.code, 'UG');
      expect(Countries.fromPhone('+15551234567')?.dial, '+1');
    });

    test('returns null for a number from no listed country', () {
      expect(Countries.fromPhone('+99912345'), isNull);
      expect(Countries.fromPhone(''), isNull);
      expect(Countries.fromPhone(null), isNull);
    });

    test('searches by name, code and dial', () {
      final uganda = Countries.all.firstWhere((c) => c.code == 'UG');
      expect(uganda.matches('uga'), isTrue);
      expect(uganda.matches('UG'), isTrue);
      expect(uganda.matches('+256'), isTrue);
      expect(uganda.matches('256'), isTrue);
      expect(uganda.matches('kenya'), isFalse);
      expect(uganda.matches(''), isTrue);
    });

    test('derives a flag from the ISO code', () {
      // Two regional indicators. Renders as a flag where the font has one and
      // as the letters "SS" where it does not, which is still readable.
      expect(Countries.defaultCountry.flag.runes.length, 2);
    });

    test('every entry is well formed', () {
      for (final country in Countries.all) {
        expect(country.code.length, 2, reason: country.name);
        expect(country.dial.startsWith('+'), isTrue, reason: country.name);
        expect(country.name, isNotEmpty);
      }
    });
  });

  group('ProfileImage', () {
    // A one-pixel PNG, base64 encoded.
    const pixel =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    test('decodes a bare base64 payload', () {
      expect(ProfileImage.decode(pixel), isNotNull);
    });

    test('decodes a data URL, which is how the column stores it', () {
      expect(ProfileImage.decode('data:image/png;base64,$pixel'), isNotNull);
    });

    test('tolerates whitespace, which survives forms and DB exports', () {
      final wrapped = 'data:image/png;base64,${pixel.substring(0, 20)}\n'
          '${pixel.substring(20)}';
      expect(ProfileImage.decode(wrapped), isNotNull);
    });

    test('returns null rather than throwing on rubbish', () {
      expect(ProfileImage.decode(null), isNull);
      expect(ProfileImage.decode(''), isNull);
      expect(ProfileImage.decode('   '), isNull);
      expect(ProfileImage.decode('not base64 at all!!'), isNull);
      expect(ProfileImage.decode('data:image/png;base64,'), isNull);
    });

    test('returns the same provider for the same string', () {
      // The point of the cache: a new MemoryImage each build misses Flutter's
      // image cache and re-decodes the photo on every frame.
      final first = ProfileImage.decode(pixel);
      final second = ProfileImage.decode(pixel);
      expect(identical(first, second), isTrue);
    });

    test('encodes picked bytes as a JPEG data URL', () {
      final encoded = ProfileImage.encode(Uint8List.fromList([1, 2, 3, 4]));
      expect(encoded.startsWith('data:image/jpeg;base64,'), isTrue);
      expect(base64Decode(encoded.split(',').last), [1, 2, 3, 4]);
    });

    test('flags a value the database column cannot hold', () {
      final small = ProfileImage.encode(Uint8List(1024));
      expect(ProfileImage.isTooLarge(small), isFalse);

      // Over the 500KB ceiling the web app documents, which is the size that
      // produces "data too long for column 'profileImage'".
      final huge = 'x' * (ProfileImage.maxEncodedBytes + 1);
      expect(ProfileImage.isTooLarge(huge), isTrue);
    });

    test('describes a size in units someone can read', () {
      expect(ProfileImage.describeSize('x' * 2048), '2 KB');
      expect(ProfileImage.describeSize('x' * (2 * 1024 * 1024)), '2.0 MB');
    });
  });
}
