import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'core/theme/motion.dart';
import 'data/api/api_client.dart';
import 'data/api/moneypay_api.dart';
import 'data/api/services_api.dart';
import 'data/storage/session_store.dart';
import 'routing/routes.dart';
import 'state/auth_controller.dart';
import 'state/notification_controller.dart';
import 'state/realtime_service.dart';
import 'state/wallet_controller.dart';
import 'ui/screens/agent/agent_cash_out_screen.dart';
import 'ui/screens/auth/forgot_password_screen.dart';
import 'ui/screens/auth/lock_screen.dart';
import 'ui/screens/auth/login_screen.dart';
import 'ui/screens/auth/register_screen.dart';
import 'ui/screens/auth/reset_password_screen.dart';
import 'ui/screens/auth/verify_phone_screen.dart';
import 'ui/screens/auth/welcome_screen.dart';
import 'ui/screens/history/transaction_history_screen.dart';
import 'ui/screens/money/buy_airtime_screen.dart';
import 'ui/screens/money/pay_bills_screen.dart';
import 'ui/screens/money/receipt_screen.dart';
import 'ui/screens/money/receive_qr_screen.dart';
import 'ui/screens/money/scan_qr_screen.dart';
import 'ui/screens/money/send_money_screen.dart';
import 'ui/screens/money/withdraw_screen.dart';
import 'ui/screens/agents/agents_screen.dart';
import 'ui/screens/profile/about_screen.dart';
import 'ui/screens/profile/edit_profile_screen.dart';
import 'ui/screens/profile/notifications_screen.dart';
import 'ui/screens/profile/profile_screen.dart';
import 'ui/screens/profile/security_screen.dart';
import 'ui/screens/shell/home_shell.dart';
import 'ui/screens/shell/pending_approvals_screen.dart';
import 'ui/screens/shell/splash_screen.dart';
import 'ui/screens/support/contact_screen.dart';
import 'ui/screens/support/help_screen.dart';
import 'ui/widgets/device_frame.dart';

/// Wires the object graph and hands it to [MaterialApp].
///
/// One [ApiClient] and one [RealtimeService] for the whole app: the client
/// holds the token cache the request interceptor reads, and the socket holds a
/// single connection that both the wallet and the bell listen to.
class MoneyPayApp extends StatelessWidget {
  const MoneyPayApp({super.key});

  /// Needed so the gate can clear routes that were pushed over it. Without it,
  /// a sign-in screen reached from Welcome stays on top of the navigator after
  /// the root swaps to the signed-in app, and the customer is left looking at
  /// the form they just submitted.
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => SessionStore()),
        Provider(
          create: (_) => RealtimeService(),
          dispose: (_, s) => s.dispose(),
        ),
        Provider(
          create: (context) => ApiClient(session: context.read<SessionStore>()),
        ),
        Provider(create: (context) => AuthApi(context.read<ApiClient>())),
        Provider(create: (context) => WalletApi(context.read<ApiClient>())),
        Provider(
          create: (context) => NotificationApi(context.read<ApiClient>()),
        ),
        Provider(create: (context) => SupportApi(context.read<ApiClient>())),
        Provider(create: (context) => ServicesApi(context.read<ApiClient>())),

        ChangeNotifierProvider(
          create: (context) => AuthController(
            authApi: context.read<AuthApi>(),
            client: context.read<ApiClient>(),
            session: context.read<SessionStore>(),
            realtime: context.read<RealtimeService>(),
          )..bootstrap(),
        ),
        ChangeNotifierProvider(
          create: (context) => WalletController(
            api: context.read<WalletApi>(),
            auth: context.read<AuthController>(),
            realtime: context.read<RealtimeService>(),
          ),
        ),
        ChangeNotifierProvider(
          create: (context) => NotificationController(
            api: context.read<NotificationApi>(),
            realtime: context.read<RealtimeService>(),
          ),
        ),
      ],
      child: MaterialApp(
        title: 'MoneyPay',
        navigatorKey: navigatorKey,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        home: const _RootGate(),
        onGenerateRoute: generateRoute,
        // Holds the app to a phone shape in a desktop browser, and pins the
        // text scale to a readable band. On a real device this is a no-op
        // beyond the text scaling.
        builder: (context, child) =>
            WebDeviceFrame(child: child ?? const SizedBox.shrink()),
      ),
    );
  }

  /// The one route table, used by the root navigator and by the shell's nested
  /// one. Public because [HomeShell] hosts a Navigator of its own so the bottom
  /// bar survives a push — see the comment there.
  static Route<dynamic>? generateRoute(RouteSettings settings) {
    Widget page() {
      switch (settings.name) {
        case Routes.welcome:
          return const WelcomeScreen();
        case Routes.login:
          return const LoginScreen();
        case Routes.register:
          return const RegisterScreen();
        case Routes.verifyPhone:
          return VerifyPhoneScreen(phone: settings.arguments as String? ?? '');
        case Routes.forgotPassword:
          return const ForgotPasswordScreen();
        case Routes.resetPassword:
          return ResetPasswordScreen(email: settings.arguments as String?);

        case Routes.sendMoney:
          return SendMoneyScreen(initialPhone: settings.arguments as String?);
        case Routes.receiveQr:
          return const ReceiveQrScreen();
        case Routes.scanQr:
          return const ScanQrScreen();
        case Routes.withdraw:
          return const WithdrawScreen();
        case Routes.buyAirtime:
          return const BuyAirtimeScreen();
        case Routes.payBills:
          return const PayBillsScreen();
        case Routes.transferReceipt:
          return ReceiptScreen(details: settings.arguments as ReceiptDetails);

        case Routes.history:
          return const TransactionHistoryScreen();
        case Routes.agents:
          return const AgentsScreen();
        case Routes.notifications:
          return const NotificationsScreen();
        case Routes.profile:
          return const ProfileScreen();
        case Routes.editProfile:
          return const EditProfileScreen();
        case Routes.security:
          return const SecurityScreen();
        case Routes.help:
          return const HelpScreen();
        case Routes.contact:
          return const ContactScreen();
        case Routes.about:
          return const AboutScreen();

        case Routes.agentCashOut:
          return const AgentCashOutScreen();
        case Routes.pendingApprovals:
          return const PendingApprovalsScreen();
      }
      return const _UnknownRoute();
    }

    return MaterialPageRoute<dynamic>(
      builder: (_) => page(),
      settings: settings,
    );
  }
}

/// Chooses what the app shows, from the session alone.
///
/// Sitting above the navigator means a session ending — a sign-out, or a token
/// the server rejected mid-request — returns to sign-in from wherever the
/// customer happened to be, with no screen needing to know about it.
class _RootGate extends StatefulWidget {
  const _RootGate();

  @override
  State<_RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<_RootGate> with WidgetsBindingObserver {
  AuthStage? _lastStage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Re-lock on the way out rather than on the way back, so the balance is
    // never briefly on screen behind the lock when the app is resumed — or in
    // the task-switcher snapshot the OS takes at this moment.
    if (state == AppLifecycleState.paused) {
      context.read<AuthController>().lock();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();

    // Signing in or out swaps the screen below the navigator, but anything
    // pushed over it - the sign-in form reached from Welcome, a half-finished
    // transfer - survives that swap and stays on top. Clearing the stack on
    // every change of stage is what makes the swap actually visible.
    if (_lastStage != null && _lastStage != auth.stage) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        MoneyPayApp.navigatorKey.currentState?.popUntil(
          (route) => route.isFirst,
        );
      });
    }
    _lastStage = auth.stage;

    final Widget screen = switch (auth.stage) {
      AuthStage.starting => const SplashScreen(),
      AuthStage.locked => const LockScreen(),
      AuthStage.signedIn => const HomeShell(),
      AuthStage.signedOut =>
        auth.hasOnboarded ? const LoginScreen() : const WelcomeScreen(),
    };

    return AnimatedSwitcher(
      duration: Motion.enter,
      switchInCurve: Motion.entering,
      switchOutCurve: Motion.leaving,
      transitionBuilder: (child, animation) => FadeTransition(
        opacity: animation,
        child: ScaleTransition(
          // Barely perceptible on its own, but it stops the swap from looking
          // like a dropped frame.
          scale: Tween<double>(begin: 0.985, end: 1).animate(animation),
          child: child,
        ),
      ),
      child: KeyedSubtree(key: ValueKey(auth.stage), child: screen),
    );
  }
}

class _UnknownRoute extends StatelessWidget {
  const _UnknownRoute();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Not found')),
      body: const Center(child: Text('That screen does not exist.')),
    );
  }
}
