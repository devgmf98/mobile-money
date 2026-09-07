import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api/api_client.dart';
import '../data/api/moneypay_api.dart';
import '../data/models/app_notification.dart';
import 'realtime_service.dart';

/// The notification bell and its list.
class NotificationController extends ChangeNotifier {
  NotificationController({
    required NotificationApi api,
    required RealtimeService realtime,
  }) : _api = api {
    _subscription = realtime.notifications.listen(_prepend);
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

  /// A live arrival from the socket. Socket payloads carry no real id, so a
  /// duplicate cannot be detected by id — matching on the text and a recent
  /// timestamp keeps a push and the row it mirrors from appearing twice.
  void _prepend(AppNotification incoming) {
    final alreadyThere = _items.any(
      (item) =>
          item.title == incoming.title &&
          item.message == incoming.message &&
          incoming.createdAt.difference(item.createdAt).abs() <
              const Duration(seconds: 30),
    );
    if (alreadyThere) return;

    _items = [incoming, ..._items];
    notifyListeners();
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
