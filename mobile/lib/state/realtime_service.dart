import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../core/config/env.dart';
import '../data/models/app_notification.dart';
import '../data/models/parse.dart';

/// The live half of the app.
///
/// The server pushes three things over Socket.IO: `balance-updated` when an
/// account's figure changes, `new-notification` when something happens worth
/// telling someone about, and `transaction-updated` when a row changes state
/// without any money moving. All are emitted into a per-user room, so the
/// socket has to announce itself with `join-user` before anything arrives —
/// connecting alone is not enough, and forgetting that is the difference
/// between a live balance and one that only moves on pull-to-refresh.
class RealtimeService extends ChangeNotifier {
  io.Socket? _socket;
  int? _joinedUserId;

  final _balances = StreamController<double>.broadcast();
  final _notifications = StreamController<AppNotification>.broadcast();
  final _transactions = StreamController<void>.broadcast();

  /// The account's new balance, straight from the server.
  Stream<double> get balanceUpdates => _balances.stream;

  /// Notifications as they are created, so the bell fills without a refresh.
  Stream<AppNotification> get notifications => _notifications.stream;

  /// A transaction changed state. Carries nothing: the row is refetched rather
  /// than patched, because the payload names an id and a status while the list
  /// shows a title, a counterparty and a total that all derive from more.
  Stream<void> get transactionUpdates => _transactions.stream;

  bool get isConnected => _socket?.connected ?? false;

  /// Why the socket is not connected, when it is not.
  ///
  /// Connection errors used to print in debug and nowhere else, so on a
  /// release build a socket that never came up was indistinguishable from one
  /// that was working and simply had nothing to say.
  String? lastSocketError;

  void connect(int userId, {required String token}) {
    /* A socket already exists for this account -- connected, or still opening.
       Leave it alone.
       
       The guard used to be `isConnected`, which is false for the second or so
       a socket takes to open. _startSession is called from four places --
       bootstrap, sign-in, unlock, and the retry on the profile -- so a second
       call landing inside that window tore down the socket that was about to
       succeed and asked for another. Reconnection after a genuine drop is
       socket.io's own job, not this method's. */
    if (_joinedUserId == userId && _socket != null) return;

    disconnect();
    _joinedUserId = userId;

    final socket = io.io(
      Env.socketUrl,
      io.OptionBuilder()
          /* Websocket only, and measured rather than assumed.

             This was briefly changed to polling-with-upgrade on the theory
             that a carrier was refusing the websocket handshake. Running the
             app's own client against the deployed server settled it:

               websocket only         CONNECTED
               polling only           TIMED OUT
               polling then upgrade   TIMED OUT

             socket_io_client's polling transport does not complete against
             this server, so opening with polling meant never connecting at
             all. The JavaScript client manages polling here perfectly well,
             which is exactly why testing it from a laptop proved nothing about
             the phone. If this ever needs revisiting, run
             tool/socket_probe.dart first. */
          .setTransports(['websocket'])
          // The server reads the identity from this and ignores whatever id
          // the client claims. Without it the connection is accepted and joins
          // nothing, so a stale build degrades to pull-to-refresh instead of
          // silently listening to a room it should not be in.
          .setAuth({'token': token})
          /* A fresh connection every time, rather than whatever this URL was
             given last.

             io.io() caches by URL, and disconnect() disposes the socket it
             hands back -- so the call above could return a socket that had
             already been thrown away, which reports no error and never
             connects. That is the shape of a live badge that never updates
             while every HTTP call on the same phone works. */
          .enableForceNew()
          .enableReconnection()
          .setReconnectionDelay(2000)
          // Retry rather than wait forever on a network that accepted the
          // socket and then went quiet.
          .setTimeout(15000)
          .enableAutoConnect()
          .build(),
    );

    // Re-joined on every connect, not just the first: a reconnection is a new
    // socket as far as the server is concerned, and it has no memory of which
    // room the old one was in.
    // The argument is vestigial -- the server takes the id from the token --
    // but the event is still what asks to be put in the room.
    socket.onConnect((_) {
      lastSocketError = null;
      socket.emit('join-user', userId);
      notifyListeners();
    });

    // Listeners are told, so a status row reading this shows what is true now
    // rather than what was true when it was first built.
    socket.onDisconnect((_) => notifyListeners());

    socket.onConnectError((error) {
      lastSocketError = '$error';
      notifyListeners();
    });

    socket.onError((error) {
      lastSocketError = '$error';
      notifyListeners();
    });

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

    // A status change moves no money, so no balance event follows it and
    // nothing else would tell the list to look again.
    socket.on('transaction-updated', (_) => _transactions.add(null));

    _socket = socket;
  }

  void disconnect() {
    _socket?.dispose();
    _socket = null;
    _joinedUserId = null;
    notifyListeners();
  }

  @override
  void dispose() {
    disconnect();
    _balances.close();
    _notifications.close();
    _transactions.close();
    super.dispose();
  }
}
