import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'state/local_notifications.dart';
import 'state/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  /* Started here, not waited for.

     Both swallow their own failures, but a failure is not the only way a
     platform channel goes wrong -- one that never answers would have held the
     first frame indefinitely, and a wallet that will not open is a worse
     outcome than a notification that does not arrive. They finish within
     milliseconds and long before anything needs them: the socket cannot
     deliver until someone has signed in, and a background push is drawn by
     Android itself. */
  unawaited(LocalNotifications.instance.init());
  unawaited(PushService.instance.initApp());

  // Portrait only. Every screen in the design is a single column sized to a
  // phone, and a rotated wallet is not a use anyone has.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const MoneyPayApp());
}
