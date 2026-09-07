/// Build-time configuration.
///
/// Both values are overridable with `--dart-define`, so a debug build can be
/// pointed at a laptop running the Express server without editing source:
///
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080/api \
///               --dart-define=SOCKET_URL=http://10.0.2.2:8080
///
/// The defaults are the deployed Railway service the web app already uses, so
/// a plain `flutter run` talks to production exactly as the website does.
class Env {
  const Env._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://mobile-money-production-b493.up.railway.app/api',
  );

  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'https://mobile-money-production-b493.up.railway.app',
  );

  /// Every amount in this system is South Sudanese Pounds. The backend has a
  /// multi-currency exchange desk, but it is an admin tool — a customer wallet
  /// only ever holds SSP.
  static const String currency = 'SSP';

  /// Dialling code used when expanding a locally-typed number for display.
  static const String countryCode = '+211';
}
