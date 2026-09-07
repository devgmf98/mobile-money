import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'state/local_notifications.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set up before the first frame so a notification arriving seconds after
  // launch has somewhere to land. Never throws: it swallows its own failures,
  // because a device that will not post notifications should still run the app.
  await LocalNotifications.instance.init();

  // Portrait only. Every screen in the design is a single column sized to a
  // phone, and a rotated wallet is not a use anyone has.
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  runApp(const MoneyPayApp());
}
