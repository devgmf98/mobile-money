import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/widgets.dart';

/// Profile pictures, which this system stores as base64 data URLs inside a
/// database column rather than as files behind a URL.
///
/// That storage choice drives everything here: the picture travels as a string
/// in the JSON body and lands in a column, so its encoded length matters in a
/// way a file upload's would not. The app compresses on capture to keep that
/// length small, and decodes through a cache so the same photo is not turned
/// back into pixels on every frame.
class ProfileImage {
  const ProfileImage._();

  /// The ceiling, matching the web app's.
  ///
  /// Deliberately generous. An earlier version of this used 500KB, taken from
  /// PROFILE_IMAGE_SETUP.md — but that document predates the column being
  /// migrated, and the live web client says so outright: the column is LONGTEXT
  /// and the server takes 100MB bodies, so its own limit exists "to catch a
  /// pathological encode, not to force the image smaller — the old 100KB gate
  /// rejected any usable photo". A tight gate here does not protect anything;
  /// it just refuses pictures the backend would have stored happily.
  ///
  /// It still has to exist, because image_picker does not always honour
  /// [captureQuality] — some formats and some devices hand back the original
  /// file untouched, and a modern camera photo base64s to several megabytes.
  static const int maxEncodedBytes = 4 * 1024 * 1024;

  /// What the picker is asked for. Compression is what normally keeps the
  /// encoded string small — typically 15-40KB, far inside the ceiling above —
  /// for a picture never shown larger than about 96 logical pixels.
  static const int captureSize = 400;
  static const int captureQuality = 45;

  /// Decoded images, keyed by the string they came from.
  ///
  /// Without this, `MemoryImage(Uint8List.fromList(...))` built a new list on
  /// every rebuild; MemoryImage compares its bytes by identity, so each one
  /// missed Flutter's image cache and re-decoded the photo from scratch — on
  /// the dashboard, on every single frame that touched the header.
  static final Map<String, MemoryImage> _cache = <String, MemoryImage>{};

  /// Small on purpose: an account sees its own picture and little else.
  static const int _cacheLimit = 8;

  /// Turns a stored value into something an [Image] can paint, or null when
  /// there is nothing usable — in which case callers fall back to initials.
  static ImageProvider? decode(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;

    final cached = _cache[raw];
    if (cached != null) return cached;

    try {
      // Accepts both a full data URL and a bare base64 payload, because the
      // column has held both over the app's life.
      final payload = raw.contains(',') ? raw.split(',').last : raw;
      // Whitespace and newlines creep into base64 that has been through a
      // form or a database export, and the strict decoder rejects them.
      final cleaned = payload.replaceAll(RegExp(r'\s'), '');
      if (cleaned.isEmpty) return null;

      final image = MemoryImage(Uint8List.fromList(base64Decode(cleaned)));

      if (_cache.length >= _cacheLimit) _cache.remove(_cache.keys.first);
      _cache[raw] = image;
      return image;
    } catch (_) {
      // A truncated or non-base64 value must not take the screen down with it.
      return null;
    }
  }

  /// Wraps picked bytes as the data URL the server expects.
  ///
  /// JPEG because `image_picker` re-encodes to JPEG whenever a quality is
  /// given, which it always is here.
  static String encode(Uint8List bytes) =>
      'data:image/jpeg;base64,${base64Encode(bytes)}';

  /// True when a value is too large to store. Checked before sending so the
  /// customer gets a sentence they can act on instead of a database error.
  static bool isTooLarge(String encoded) => encoded.length > maxEncodedBytes;

  /// Roughly how big an encoded value is, for a message.
  static String describeSize(String encoded) {
    final kb = encoded.length / 1024;
    return kb >= 1024
        ? '${(kb / 1024).toStringAsFixed(1)} MB'
        : '${kb.round()} KB';
  }
}
