import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config/env.dart';
import '../data/models/app_notification.dart';
import '../data/models/parse.dart';

/// The live half of the app.
///
/// The server pushes two things over Socket.IO: `balance-updated` when an
/// account's figure changes, and `new-notification` when something happens
/// worth telling someone about. Both are emitted into a per-user room, so the
/// socket has to announce itself with `join-user` before anything arrives —
/// connecting alone is not enough, and forgetting that is the difference
/// between a live balance and one that only moves on pull-to-refresh.
class RealtimeService {
  io.Socket? _socket;
  int? _joinedUserId;

  final _balances = StreamController<double>.broadcast();
  final _notifications = StreamController<AppNotification>.broadcast();

  /// The account's new balance, straight from the server.
  Stream<double> get balanceUpdates => _balances.stream;

  /// Notifications as they are created, so the bell fills without a refresh.
  Stream<AppNotification> get notifications => _notifications.stream;

  bool get isConnected => _socket?.connected ?? false;

  void connect(int userId) {
    if (_joinedUserId == userId && isConnected) return;

    disconnect();
    _joinedUserId = userId;

    final socket = io.io(
      Env.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .enableReconnection()
          .setReconnectionDelay(2000)
          .enableAutoConnect()
          .build(),
    );

    // Re-joined on every connect, not just the first: a reconnection is a new
    // socket as far as the server is concerned, and it has no memory of which
    // room the old one was in.
    socket.onConnect((_) => socket.emit('join-user', userId));

    socket.on('balance-updated', (data) {
      final map = P.toMap(data);
      if (map == null) return;
      // The room is per-user, but the payload names its subject anyway — so
      // check it rather than trusting delivery.
      if (P.toIntOrNull(map['userId']) != userId) return;
      _balances.add(P.toDouble(map['balance']));
    });

    socket.on('new-notification', (data) {
      final map = P.toMap(data);
      if (map == null) return;
      _notifications.add(AppNotification.fromSocket(map));
    });

    if (kDebugMode) {
      socket.onConnectError((error) => debugPrint('Socket error: $error'));
    }

    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _joinedUserId = null;
  }

  void dispose() {
    disconnect();
    _balances.close();
    _notifications.close();
  }
}
