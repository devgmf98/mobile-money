import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api/api_client.dart';
import '../data/api/moneypay_api.dart';
import '../data/models/app_user.dart';
import '../data/storage/session_store.dart';
import 'realtime_service.dart';

/// Where the app should be, given what it knows about the session.
enum AuthStage {
  /// Reading the stored session — the splash screen holds here.
  starting,

  /// No session; show the welcome and sign-in flow.
  signedOut,

  /// A session exists but the app lock is on and has not been satisfied.
  locked,

  signedIn,
}

/// Owns the session: who is signed in, and everything that changes that.
class AuthController extends ChangeNotifier {
  AuthController({
    required AuthApi authApi,
    required ApiClient client,
    required SessionStore session,
    required RealtimeService realtime,
  }) : _authApi = authApi,
       _session = session,
       _realtime = realtime {
    // One place decides what a rejected token means, so no screen has to.
    client.onUnauthorised = () => signOut(expired: true);
  }

  final AuthApi _authApi;
  final SessionStore _session;
  final RealtimeService _realtime;

  AuthStage _stage = AuthStage.starting;
  AppUser? _user;
  bool _hasOnboarded = false;
  bool _busy = false;

  /// Set when a session ends because the server rejected the token, so the
  /// sign-in screen can explain why the customer is suddenly back there.
  String? _expiryNotice;

  AuthStage get stage => _stage;
  AppUser? get user => _user;
  bool get hasOnboarded => _hasOnboarded;
  bool get isBusy => _busy;
  String? get expiryNotice => _expiryNotice;

  bool get isAgent => _user?.role.isAgent ?? false;

  /// Restores the stored session on launch.
  Future<void> bootstrap() async {
    _hasOnboarded = await _session.hasOnboarded();
    final token = await _session.readToken();
    final cached = await _session.readUser();

    if (token == null || token.isEmpty || cached == null) {
      _set(AuthStage.signedOut);
      return;
    }

    _user = cached;
    final pin = await _session.readPin();
    _set(pin == null ? AuthStage.signedIn : AuthStage.locked);

    if (_stage == AuthStage.signedIn) _startSession(cached);

    // The cached copy gets the app on screen immediately; the authoritative
    // one lands a moment later. A failure here is not fatal — an expired token
    // is handled by the 401 hook, and anything else just means stale figures
    // until the next refresh.
    unawaited(refreshProfile());
  }

  Future<void> completeOnboarding() async {
    _hasOnboarded = true;
    await _session.markOnboarded();
    notifyListeners();
  }

  /// Signs in with the account's email and password.
  ///
  /// Two failures are worth distinguishing to the caller: an unverified phone
  /// (403 with `needsVerification`, which should route to the code screen
  /// rather than show an error) and everything else.
  Future<void> signIn({required String email, required String password}) async {
    _setBusy(true);
    try {
      final result = await _authApi.login(email: email, password: password);

      if (result.user.role.isStaff) {
        throw const ApiException(
          'Administrator accounts are managed from the MoneyPay web console. '
          'Please sign in there instead.',
        );
      }

      await _session.writeToken(result.token);
      await _session.writeUser(result.user);

      _user = result.user;
      _expiryNotice = null;
      _set(AuthStage.signedIn);
      _startSession(result.user);

      unawaited(refreshProfile());
    } finally {
      _setBusy(false);
    }
  }

  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required bool asAgent,
  }) async {
    _setBusy(true);
    try {
      return await _authApi.register(
        name: name,
        email: email,
        phone: phone,
        password: password,
        role: asAgent ? 'agent' : 'user',
      );
    } finally {
      _setBusy(false);
    }
  }

  Future<void> verifyPhone({required String phone, required String code}) {
    return _authApi.verifyPhone(phone: phone, code: code);
  }

  Future<void> resendVerification(String phone) =>
      _authApi.resendVerification(phone);

  Future<void> forgotPassword(String email) => _authApi.forgotPassword(email);

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) => _authApi.resetPassword(email: email, code: code, password: password);

  /// Pulls the authoritative account record. Quiet by design: it runs on every
  /// launch and on returning to the dashboard, and a blocked screen or an error
  /// banner on a background refresh would be worse than a stale balance.
  Future<void> refreshProfile() async {
    if (_user == null) return;
    try {
      final fresh = await _authApi.profile();
      _user = _user!.mergeWith(fresh);
      await _session.writeUser(_user!);
      notifyListeners();
    } on ApiException {
      /* Keep the cached account. */
    }
  }

  /// Saves the editable parts of the account.
  ///
  /// The picture is checked on the way back. It is stored as base64 inside a
  /// database column, and if that column has not been migrated to LONGTEXT
  /// (see `backend/PROFILE_IMAGE_MIGRATION.md`) MySQL running outside strict
  /// mode *truncates it and returns success* — the request is a 200, the name
  /// saves, and the photo silently becomes a 255-character fragment that
  /// decodes to nothing. Comparing what came back against what went out is the
  /// only way to tell that apart from a save that worked.
  Future<void> updateProfile({
    String? name,
    String? profileImage,
    String? idNumber,
    bool? autoAdminCashout,
  }) async {
    _setBusy(true);
    try {
      final updated = await _authApi.updateProfile(
        name: name,
        profileImage: profileImage,
        idNumber: idNumber,
        autoAdminCashout: autoAdminCashout,
      );

      _user = (_user ?? updated).mergeWith(updated);
      await _session.writeUser(_user!);
      notifyListeners();

      if (profileImage != null) {
        final stored = updated.profileImage;

        if (stored == null || stored.isEmpty) {
          throw const ApiException(
            'Your details were saved, but the picture was not stored. The '
            'server accepted it and returned nothing back.',
          );
        }

        // Truncation, not a mismatch in encoding: the stored value is a strict
        // prefix of what was sent, cut short by the column's width.
        if (stored.length < profileImage.length) {
          throw ApiException(
            'Your details were saved, but the picture was cut short by the '
            'database (${stored.length} of ${profileImage.length} characters '
            'stored). The profileImage column needs migrating to LONGTEXT.',
          );
        }
      }
    } finally {
      _setBusy(false);
    }
  }

  /// Applies a balance the server pushed over the socket, or one read back from
  /// a completed transfer.
  void applyBalance(double balance) {
    final current = _user;
    if (current == null || current.balance == balance) return;
    _user = current.copyWith(balance: balance);
    unawaited(_session.writeUser(_user!));
    notifyListeners();
  }

  // ---------------------------------------------------------------- app lock

  Future<bool> get hasAppLock async => (await _session.readPin()) != null;

  Future<void> setAppLock(String pin) => _session.writePin(pin);

  Future<void> removeAppLock() => _session.clearPin();

  Future<bool> unlock(String pin) async {
    final stored = await _session.readPin();
    if (stored == null || stored != pin) return false;
    _set(AuthStage.signedIn);
    final current = _user;
    if (current != null) _startSession(current);
    return true;
  }

  /// Re-locks on returning to the app from the background.
  Future<void> lock() async {
    if (_stage != AuthStage.signedIn) return;
    if (await _session.readPin() == null) return;
    _realtime.disconnect();
    _set(AuthStage.locked);
  }

  Future<void> signOut({bool expired = false}) async {
    _realtime.disconnect();
    await _session.clear();
    _user = null;
    _expiryNotice = expired
        ? 'Your session has expired. Please sign in again.'
        : null;
    _set(AuthStage.signedOut);
  }

  void acknowledgeExpiry() {
    if (_expiryNotice == null) return;
    _expiryNotice = null;
    notifyListeners();
  }

  void _startSession(AppUser user) => _realtime.connect(user.id);

  void _set(AuthStage stage) {
    _stage = stage;
    notifyListeners();
  }

  void _setBusy(bool value) {
    _busy = value;
    notifyListeners();
  }
}
