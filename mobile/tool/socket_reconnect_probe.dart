/* Reproduces what the app does, not what it means to do.
 *
 * _startSession runs from four places -- bootstrap, sign-in, unlock and the
 * retry on the profile -- so a second connect() lands while the first socket
 * is still opening. That path disposes the in-flight socket and calls io.io()
 * again for the same URL, and io.io() caches by URL.
 *
 * This runs that sequence both ways to show whether the second socket
 * connects.
 *
 *   dart run tool/socket_reconnect_probe.dart
 */
import 'dart:async';
import 'dart:io';

import 'package:socket_io_client/socket_io_client.dart' as io;

const _url = 'https://mobile-money-production-b493.up.railway.app';

io.Socket _build({required bool forceNew}) {
  final builder = io.OptionBuilder()
      .setTransports(['websocket'])
      .setAuth({'token': 'probe'})
      .disableReconnection()
      .setTimeout(15000)
      .enableAutoConnect();
  if (forceNew) builder.enableForceNew();
  return io.io(_url, builder.build());
}

Future<String> _run({required bool forceNew}) async {
  // First attempt, as bootstrap makes it.
  final first = _build(forceNew: forceNew);

  // A second call arriving before the first has opened -- unlock, or the
  // retry button. The old code disposed here and asked for another.
  await Future<void>.delayed(const Duration(milliseconds: 150));
  first.dispose();

  final second = _build(forceNew: forceNew);
  final done = Completer<String>();
  second.onConnect((_) {
    if (!done.isCompleted) done.complete('CONNECTED');
  });
  second.onConnectError((e) {
    if (!done.isCompleted) done.complete('CONNECT ERROR: $e');
  });
  Timer(const Duration(seconds: 12), () {
    if (!done.isCompleted) done.complete('NEVER CONNECTED');
  });

  final result = await done.future;
  second.dispose();
  return result;
}

Future<void> main() async {
  stdout.writeln('second socket after disposing the first:\n');
  stdout.writeln('  without forceNew   ${await _run(forceNew: false)}');
  stdout.writeln('  with forceNew      ${await _run(forceNew: true)}');
  exit(0);
}
