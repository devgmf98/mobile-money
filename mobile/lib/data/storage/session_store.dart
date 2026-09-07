import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/app_user.dart';

/// Where the session lives between launches.
///
/// The bearer token goes to the platform keystore (Android EncryptedSharedPrefs
/// / iOS Keychain) because it is a credential — anything holding it can move
/// money. The cached account and the app-lock preference are ordinary
/// preferences: losing them costs a round trip, not an account.
class SessionStore {
  SessionStore({FlutterSecureStorage? secure}) : _secure = secure ?? _defaults;

  static const _defaults = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
  );

  static const _tokenKey = 'moneypay.token';
  static const _pinKey = 'moneypay.app_pin';
  static const _userKey = 'moneypay.user';
  static const _onboardedKey = 'moneypay.onboarded';
  static const _biometricKey = 'moneypay.biometric';

  final FlutterSecureStorage _secure;
  SharedPreferences? _prefs;

  /// Held in memory so the request interceptor does not hit the keystore on
  /// every single call — reading secure storage is a platform channel round
  /// trip, and a busy screen makes several requests at once.
  String? _cachedToken;
  bool _tokenLoaded = false;

  Future<SharedPreferences> get _preferences async =>
      _prefs ??= await SharedPreferences.getInstance();

  Future<String?> readToken() async {
    if (_tokenLoaded) return _cachedToken;
    try {
      _cachedToken = await _secure.read(key: _tokenKey);
    } catch (_) {
      // A keystore that cannot be opened (a restored backup on a new device,
      // most often) reads as "no session" rather than crashing the launch.
      _cachedToken = null;
    }
    _tokenLoaded = true;
    return _cachedToken;
  }

  Future<void> writeToken(String token) async {
    _cachedToken = token;
    _tokenLoaded = true;
    try {
      await _secure.write(key: _tokenKey, value: token);
    } catch (_) {
      // The in-memory copy still carries this session; only persistence fails.
    }
  }

  Future<AppUser?> readUser() async {
    final prefs = await _preferences;
    final raw = prefs.getString(_userKey);
    if (raw == null || raw.isEmpty) return null;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map<String, dynamic>) return AppUser.fromJson(decoded);
    } catch (_) {
      await prefs.remove(_userKey);
    }
    return null;
  }

  Future<void> writeUser(AppUser user) async {
    final prefs = await _preferences;
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  /// A four-digit code that unlocks the app on reopening. It is a convenience
  /// over the session already held on the device, not an account credential —
  /// the server never sees it and it cannot be used to sign in anywhere else.
  Future<String?> readPin() async {
    try {
      return await _secure.read(key: _pinKey);
    } catch (_) {
      return null;
    }
  }

  Future<void> writePin(String pin) async {
    try {
      await _secure.write(key: _pinKey, value: pin);
    } catch (_) {
      /* Lock simply stays off if the keystore refuses. */
    }
  }

  Future<void> clearPin() async {
    try {
      await _secure.delete(key: _pinKey);
    } catch (_) {
      /* Nothing to clear. */
    }
  }

  Future<bool> readBiometricPreference() async {
    final prefs = await _preferences;
    return prefs.getBool(_biometricKey) ?? false;
  }

  Future<void> writeBiometricPreference(bool enabled) async {
    final prefs = await _preferences;
    await prefs.setBool(_biometricKey, enabled);
  }

  Future<bool> hasOnboarded() async {
    final prefs = await _preferences;
    return prefs.getBool(_onboardedKey) ?? false;
  }

  Future<void> markOnboarded() async {
    final prefs = await _preferences;
    await prefs.setBool(_onboardedKey, true);
  }

  /// Signing out drops the credential and the cached account, but keeps the
  /// onboarding flag — someone signing back in should not be walked through
  /// the welcome screens again.
  Future<void> clear() async {
    _cachedToken = null;
    _tokenLoaded = true;
    try {
      await _secure.delete(key: _tokenKey);
      await _secure.delete(key: _pinKey);
    } catch (_) {
      /* Best effort. */
    }
    final prefs = await _preferences;
    await prefs.remove(_userKey);
    await prefs.remove(_biometricKey);
  }
}
