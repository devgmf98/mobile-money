import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../data/models/app_notification.dart';
import 'local_notifications.dart';

/// Handles a push that arrives while the app is in the background or closed.
///
/// Runs in its own isolate with no access to anything this app has set up, so
/// it can only do what it can do alone. Android draws the notification itself
/// from the `notification` block of the payload, so the work here is nil —
/// the handler exists because Firebase requires one registered before
/// `getToken`, and without it background delivery is dropped.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  if (kDebugMode) debugPrint('Background push: ${message.messageId}');
}

/// Push notifications: the half that reaches a phone with the app closed.
///
/// The socket covers everything while the app is running, and local
/// notifications put those events in the tray. Neither survives the app being
/// killed — there is no connection to receive on. This is what does, and the
/// only thing the app has to do is hand the server a token to send to.
///
/// Every failure here is swallowed. Push is an extra on top of a wallet that
/// already works; a device with no Play Services, or a Firebase project that
/// has not been set up for it, must not stop someone checking their balance.
class PushService {
  PushService._();

  static final PushService instance = PushService._();

  bool _started = false;
  StreamSubscription<RemoteMessage>? _foreground;
  StreamSubscription<String>? _refresh;

  /// The current device token, or null if push is unavailable here.
  String? token;

  /// Starts Firebase and returns the device token.
  ///
  /// [onToken] is called with the token now and again whenever Firebase
  /// rotates it — which it does on reinstall, restore and occasionally on its
  /// own, so registering once at sign-in is not enough.
  Future<void> start({required Future<void> Function(String token) onToken}) async {
    if (_started) return;

    try {
      await Firebase.initializeApp();

      FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

      final messaging = FirebaseMessaging.instance;

      // iOS will not deliver anything until this is granted; on Android the
      // local-notification permission covers it, and asking twice is
      // harmless because the system only prompts once.
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      final current = await messaging.getToken();
      if (current != null && current.isNotEmpty) {
        token = current;
        await onToken(current);
      }

      _refresh = messaging.onTokenRefresh.listen((fresh) async {
        token = fresh;
        await onToken(fresh);
      });

      // A push that lands while the app is open is not drawn by the system, so
      // it is drawn here — the same tray entry the socket would have produced,
      // which also means one arriving by both routes replaces rather than
      // duplicates, since both key on the server's notification id.
      _foreground = FirebaseMessaging.onMessage.listen((message) {
        final title = message.notification?.title ?? message.data['title'];
        final body = message.notification?.body ?? message.data['message'];
        if (title == null && body == null) return;

        LocalNotifications.instance.show(
          AppNotification(
            id: int.tryParse('${message.data['id']}') ?? 0,
            title: title ?? 'MoneyPay',
            message: body ?? '',
            kind: NotificationKind.parse(message.data['type']),
            isRead: false,
            createdAt: DateTime.now(),
          ),
        );
      });

      _started = true;
    } catch (error) {
      if (kDebugMode) debugPrint('Push unavailable: $error');
    }
  }

  /// Drops the token so the next person to sign in on this phone does not
  /// receive the last person's money notifications.
  Future<void> stop() async {
    await _foreground?.cancel();
    await _refresh?.cancel();
    _foreground = null;
    _refresh = null;
    _started = false;

    try {
      await FirebaseMessaging.instance.deleteToken();
    } catch (_) {
      /* nothing worth reporting */
    }
    token = null;
  }
}
