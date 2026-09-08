/* Does the app's own socket client reach the deployed server?
 *
 * Every check so far used the JavaScript client from a laptop. This uses
 * socket_io_client, the exact package and the exact options the app builds,
 * against the real server -- which is the one combination that had never been
 * tried, and the one the phone actually runs.
 *
 *   dart run tool/socket_probe.dart [url]
 */
import 'dart:async';
import 'dart:io';

import 'package:socket_io_client/socket_io_client.dart' as io;

Future<void> attempt(String url, List<String> transports, String label) async {
  final done = Completer<String>();

  final socket = io.io(
    url,
    io.OptionBuilder()
        .setTransports(transports)
        .setAuth({'token': 'probe-token-not-a-real-jwt'})
        .disableReconnection()
        .setTimeout(15000)
        .enableAutoConnect()
        .build(),
  );

  socket.onConnect((_) {
    if (!done.isCompleted) done.complete('CONNECTED');
  });
  socket.onConnectError((error) {
    if (!done.isCompleted) done.complete('CONNECT ERROR: $error');
  });
  socket.onError((error) {
    if (!done.isCompleted) done.complete('ERROR: $error');
  });

  Timer(const Duration(seconds: 20), () {
    if (!done.isCompleted) done.complete('TIMED OUT');
  });

  final result = await done.future;
  stdout.writeln('${label.padRight(24)} $result');
  socket.dispose();
}

Future<void> main(List<String> args) async {
  final url = args.isNotEmpty
      ? args.first
      : 'https://mobile-money-production-b493.up.railway.app';
  stdout.writeln('probing $url\n');

  await attempt(url, ['websocket'], 'websocket only');
  await attempt(url, ['polling'], 'polling only');
  await attempt(url, ['polling', 'websocket'], 'polling then upgrade');

  exit(0);
}
