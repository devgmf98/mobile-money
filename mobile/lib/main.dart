import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'state/local_notifications.dart';
import 'state/push_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set up before the first frame so a notification arriving seconds after
  // launch has somewhere to land. Never throws: it swallows its own failures,
  // because a device that will not post notifications should still run the app.
  await LocalNotifications.instance.init();

  // Firebase before the first frame, so the background handler is registered
  // from a cold start rather than only once somebody signs in.
  await PushService.instance.initApp();

  // Portrait only. Every screen in the design is a single column sized to a
  // phone, and a rotated wallet is not a use anyone has.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const MoneyPayApp());
}
