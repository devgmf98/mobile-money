import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api/api_client.dart';
import '../data/api/moneypay_api.dart';
import '../data/models/app_notification.dart';
import 'local_notifications.dart';
import 'realtime_service.dart';

/// The notification bell and its list.
class NotificationController extends ChangeNotifier {
  NotificationController({
    required NotificationApi api,
    required RealtimeService realtime,
  }) : _api = api {
    _subscription = realtime.notifications.listen((notification) {
      // Only posted to the tray when it was actually new. The same event can
      // arrive twice -- over the socket and again as a push -- and posting on
      // both would leave two entries for one payment, since the two carry
      // different ids and the system would not collapse them.
      if (!_prepend(notification)) return;

      // Fire and forget: the list above is the source of truth and must not
      // wait on the platform.
      unawaited(LocalNotifications.instance.show(notification));
    });
  }

  final NotificationApi _api;
  late final StreamSubscription<AppNotification> _subscription;

  List<AppNotification> _items = const [];
  bool _loading = false;
  String? _error;

  List<AppNotification> get items => _items;
  bool get isLoading => _loading;
  String? get error => _error;

  int get unreadCount => _items.where((item) => !item.isRead).length;
  bool get hasUnread => unreadCount > 0;

  Future<void> refresh({bool silent = false}) async {
    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }
    try {
      _items = await _api.list();
      _error = null;
    } on ApiException catch (error) {
      _error = error.message;
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  /// Optimistic: the row greys out at once and the request follows. If it
  /// fails, a refresh puts the badge back rather than leaving a lie on screen.
  Future<void> markRead(AppNotification notification) async {
    if (notification.isRead) return;
    _replace(notification.id, notification.markRead());

    // A row that arrived over the socket carries a synthetic negative id — the
    // server does not send one. Marking that read would be a guaranteed 404, so
    // fetch the real row instead and let the next tap act on it.
    if (notification.id < 0) {
      await refresh(silent: true);
      return;
    }

    try {
      await _api.markRead(notification.id);
    } on ApiException {
      await refresh(silent: true);
    }
  }

  Future<void> markAllRead() async {
    if (!hasUnread) return;
    final previous = _items;
    _items = _items.map((item) => item.markRead()).toList(growable: false);
    notifyListeners();
    try {
      await _api.markAllRead();
    } on ApiException {
      _items = previous;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> remove(AppNotification notification) async {
    final previous = _items;
    _items = _items
        .where((item) => item.id != notification.id)
        .toList(growable: false);
    notifyListeners();
    try {
      await _api.remove(notification.id);
    } on ApiException {
      _items = previous;
      notifyListeners();
      rethrow;
    }
  }

  /// A live arrival from the socket or a push.
  ///
  /// Matched on the server's row id, which both routes now carry: the same
  /// notification arriving twice is the same id, and two genuinely separate
  /// events are two ids however alike they read.
  ///
  /// The text-and-timestamp fallback below is only for a payload with no id —
  /// a server that has not been redeployed. It was the only rule, and it was
  /// wrong: two top-ups of the same amount inside thirty seconds produce the
  /// same title and the same message, so the second was silently swallowed and
  /// never reached the tray. Identical payments are ordinary, not duplicates.
  ///
  /// Returns whether it was added, so the caller can tell a new event from a
  /// repeat of one already held.
  bool _prepend(AppNotification incoming) {
    if (isDuplicate(_items, incoming)) return false;

    _items = [incoming, ..._items];
    notifyListeners();
    return true;
  }

  /// Whether [incoming] is something already held, rather than a new event.
  ///
  /// Pure and static so the rule can be tested directly: building the
  /// controller means building an API client and a session store, and this is
  /// the part worth pinning.
  @visibleForTesting
  static bool isDuplicate(
    List<AppNotification> items,
    AppNotification incoming,
  ) {
    if (incoming.id > 0) {
      return items.any((item) => item.id == incoming.id);
    }
    return items.any(
      (item) =>
          item.title == incoming.title &&
          item.message == incoming.message &&
          incoming.createdAt.difference(item.createdAt).abs() <
              const Duration(seconds: 30),
    );
  }

  void _replace(int id, AppNotification updated) {
    _items = _items
        .map((item) => item.id == id ? updated : item)
        .toList(growable: false);
    notifyListeners();
  }

  void clear() {
    _items = const [];
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}
