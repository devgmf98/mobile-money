import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import '../data/models/app_notification.dart';

/// System notifications, shown by the app itself.
///
/// The socket already tells the app when money moves; what was missing was the
/// entry in the tray, so someone who has the app in the background finds out
/// when they next glance at their phone rather than when they next open it.
///
/// Local rather than push, deliberately. A push notification would arrive with
/// the app closed, but it needs Firebase and APNs credentials and a server that
/// sends them — none of which exist here. This covers the app running,
/// foreground or backgrounded, which is the case that was silently broken.
class LocalNotifications {
  LocalNotifications._();

  static final LocalNotifications instance = LocalNotifications._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  /// Why setup failed, kept for the status row on the profile.
  ///
  /// Everything here swallows its own failures so a device that cannot post
  /// notifications still runs the app. That is right, but it left no way to
  /// tell "working" from "silently broken" on a release build, which is how
  /// three rounds of guessing started.
  String? lastError;

  bool get isReady => _ready;

  /// Android needs a channel declared before anything can be posted to it, and
  /// the importance set here is what decides whether a notification appears as
  /// a heads-up banner or only in the shade. Money arriving is worth a banner.
  static const _channel = AndroidNotificationDetails(
    'moneypay_activity',
    'Account activity',
    channelDescription:
        'Money sent and received, and requests waiting on your approval.',
    importance: Importance.high,
    priority: Priority.high,
    icon: '@mipmap/ic_launcher',
  );

  static const _details = NotificationDetails(
    android: _channel,
    iOS: DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    ),
  );

  /// Sets the plugin up and asks for permission.
  ///
  /// Safe to call more than once — it does nothing after the first success, so
  /// a sign-out and sign-in does not re-prompt.
  Future<void> init() async {
    if (_ready) return;

    try {
      await _plugin.initialize(
        const InitializationSettings(
          android: AndroidInitializationSettings('@mipmap/ic_launcher'),
          // Permission is requested separately below rather than at
          // initialize: asking the moment the app opens, before anyone has
          // seen what it does, is how you get a permanent refusal.
          iOS: DarwinInitializationSettings(
            requestAlertPermission: false,
            requestBadgePermission: false,
            requestSoundPermission: false,
          ),
        ),
      );
      /* Ready as soon as the plugin is, and before anything optional runs.

         The channel below used to be created inside this same block ahead of
         this line, so a throw there left _ready false and show() returned
         early for every notification -- foreground included. One optional step
         failing switched the whole feature off. Nothing after this point may
         decide whether notifications work. */
      _ready = true;
      await _createAndroidChannel();
    } catch (error) {
      // A device that refuses to set the plugin up should not take the app
      // down with it — everything here is an extra on top of a screen that
      // already updates itself.
      lastError = '$error';
      if (kDebugMode) debugPrint('Notifications unavailable: $error');
    }
  }

  /// Declares the Android channel up front.
  ///
  /// flutter_local_notifications creates it lazily, when it first posts
  /// something. A push arriving with the app closed is drawn by Android itself
  /// from the channel named in the payload, and on Android 8 and up one
  /// addressed to a channel that does not exist yet is dropped -- so a phone
  /// that had never shown a foreground notification received no background
  /// ones either.
  ///
  /// Failing is survivable: without this the channel is still created the
  /// first time something is posted in the foreground, which is where it was
  /// before. It must never take the rest of the feature down with it.
  Future<void> _createAndroidChannel() async {
    try {
      await _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.createNotificationChannel(
            const AndroidNotificationChannel(
              'moneypay_activity',
              'Account activity',
              description:
                  'Money sent and received, and requests waiting on your '
                  'approval.',
              importance: Importance.high,
            ),
          );
    } catch (error) {
      if (kDebugMode) debugPrint('Notification channel not created: $error');
    }
  }

  /// Asks for permission, on the platforms that have one to ask for.
  ///
  /// Android has required this since 13; older versions grant it at install.
  /// Called once the account is open, so the prompt lands on someone who has
  /// seen what the app is for.
  Future<void> requestPermission() async {
    if (!_ready) await init();
    if (!_ready) return;

    try {
      await _plugin
          .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin
          >()
          ?.requestNotificationsPermission();

      await _plugin
          .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin
          >()
          ?.requestPermissions(alert: true, badge: true, sound: true);
    } catch (error) {
      if (kDebugMode) debugPrint('Notification permission failed: $error');
    }
  }

  /// Posts one notification for an event that just arrived.
  Future<void> show(AppNotification notification) async {
    if (!_ready) await init();
    if (!_ready) return;

    try {
      await _plugin.show(
        // The server's own row id, so each notification is its own entry and
        // the same one arriving twice — over the socket and again as a push —
        // replaces itself rather than stacking a duplicate underneath.
        //
        // Without an id every notification was posted under the same key, so
        // each new one quietly replaced the last and only ever one was in the
        // tray. A time-derived value keeps them distinct in that case; it
        // gives up the replace-on-repeat behaviour, which is the right trade
        // when the alternative is showing only the most recent.
        notification.id > 0
            ? notification.id
            : DateTime.now().microsecondsSinceEpoch.remainder(0x7FFFFFFF),
        notification.title,
        notification.message,
        _details,
      );
    } catch (error) {
      if (kDebugMode) debugPrint('Could not post notification: $error');
    }
  }

  /// Clears everything this app has posted. Used on sign-out, so a shared
  /// phone does not leave one person's money in another person's tray.
  Future<void> clearAll() async {
    if (!_ready) return;
    try {
      await _plugin.cancelAll();
    } catch (_) {
      /* nothing worth reporting */
    }
  }
}
