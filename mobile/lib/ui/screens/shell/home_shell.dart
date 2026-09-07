import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../app.dart';
import '../../../core/theme/app_colors.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../../state/notification_controller.dart';
import '../../../state/wallet_controller.dart';
import '../dashboard/dashboard_screen.dart';

/// The signed-in frame.
///
/// The bar follows the web app's `BottomNav`, with the fourth slot changing for
/// an agent exactly as that component does, and Profile in the last slot.
///
/// It hosts a [Navigator] of its own. Everything used to be pushed onto the
/// root navigator, which meant every screen covered this widget entirely and
/// took the bottom bar with it — open Send Money and the bar was simply gone.
/// The web app's bar is `position: fixed` and never leaves; a nested navigator
/// is how the same thing is had here. Screens push onto it without knowing,
/// because `Navigator.of(context)` finds the nearest one.
///
/// Deliberately a plain container rather than a [BottomAppBar] with a notched
/// shape and a docked [FloatingActionButton]: that arrangement asks for
/// `Scaffold.geometryOf()` while clipping the notch, which the framework only
/// permits during paint, so every hit test throws.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  final _navigator = GlobalKey<NavigatorState>();

  static const String _dashboardRoute = '/';

  /// The route on top of the nested stack, so the bar can mark the tab that
  /// matches it.
  String _current = _dashboardRoute;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _reload();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /* Android suspends the isolate when the app is not visible, which takes the
     socket with it. Nothing is replayed on reconnect, so every event that
     happened while the app was away is simply not delivered -- the balance,
     the lists and the bell all stay as they were, and the first thing back on
     screen is out of date without looking it.

     Reloading on resume is what closes that gap. It is also the only route for
     an event missed while away: push puts it in the tray, and this is what
     puts it in the app. */
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) _reload();
  }

  void _reload() {
    // The socket first: reconnecting it is what stops the next event needing
    // this same catch-up.
    unawaited(context.read<AuthController>().ensureRealtime());

    // Silent: this runs on every return to the app, and a spinner over content
    // that is almost always still correct reads as a fault rather than a
    // refresh.
    context.read<WalletController>().refresh(silent: true);
    context.read<NotificationController>().refresh(silent: true);
  }

  /// Goes to a destination without stacking duplicates.
  ///
  /// Tapping Send twice would otherwise put two send forms on the stack, so
  /// backing out of one landed on the other. Popping to the dashboard first
  /// keeps every tab one push deep, and back always returns here.
  void _go(String route) {
    if (route == _current) return;

    final navigator = _navigator.currentState;
    if (navigator == null) return;

    navigator.popUntil((r) => r.isFirst);
    if (route != _dashboardRoute) navigator.pushNamed(route);
  }

  void _onRouteChanged(String? name) {
    final route = name ?? _dashboardRoute;
    if (route == _current || !mounted) return;
    setState(() => _current = route);
  }

  @override
  Widget build(BuildContext context) {
    final isAgent = context.select<AuthController, bool>((a) => a.isAgent);

    final items = <_NavItem>[
      const _NavItem(
        // A house reads as "home"; this tab is labelled Dashboard and shows
        // panels of figures, so the icon says what the label says.
        icon: Icons.space_dashboard_rounded,
        label: 'Dashboard',
        route: _dashboardRoute,
      ),
      const _NavItem(
        icon: Icons.send_rounded,
        label: 'Send',
        route: Routes.sendMoney,
      ),
      const _NavItem(
        icon: Icons.qr_code_scanner_rounded,
        label: 'Scan',
        route: Routes.scanQr,
      ),
      // A customer withdraws cash; an agent's equivalent slot is their own
      // ledger, matching the web app's agent nav.
      isAgent
          ? const _NavItem(
              icon: Icons.history_rounded,
              label: 'History',
              route: Routes.history,
            )
          : const _NavItem(
              icon: Icons.payments_outlined,
              label: 'Withdraw',
              route: Routes.withdraw,
            ),
      const _NavItem(
        icon: Icons.person_rounded,
        label: 'Profile',
        route: Routes.profile,
      ),
    ];

    return PopScope(
      // The nested stack unwinds before the system back gesture is allowed to
      // leave the shell.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final navigator = _navigator.currentState;
        if (navigator != null && navigator.canPop()) navigator.pop();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        body: Navigator(
          key: _navigator,
          initialRoute: _dashboardRoute,
          observers: [_RouteWatcher(onChanged: _onRouteChanged)],
          onGenerateRoute: (settings) {
            if (settings.name == _dashboardRoute) {
              return MaterialPageRoute<void>(
                builder: (_) => const DashboardScreen(),
                settings: settings,
              );
            }
            return MoneyPayApp.generateRoute(settings);
          },
        ),
        bottomNavigationBar: _BottomBar(
          items: items,
          current: _current,
          onSelected: _go,
        ),
      ),
    );
  }
}

/// Reports the route on top of the nested stack, so the bar follows it —
/// including when a screen is left with the back button rather than the bar.
class _RouteWatcher extends NavigatorObserver {
  _RouteWatcher({required this.onChanged});

  final ValueChanged<String?> onChanged;

  void _report(Route<dynamic>? route) => onChanged(route?.settings.name);

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _report(route);

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _report(previousRoute);

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _report(previousRoute);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      _report(newRoute);
}

class _NavItem {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final String label;
  final String route;
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.items,
    required this.current,
    required this.onSelected,
  });

  final List<_NavItem> items;
  final String current;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        boxShadow: AppColors.navLift,
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 68,
          child: Row(
            children: [
              for (final item in items)
                Expanded(
                  child: _Tab(
                    icon: item.icon,
                    label: item.label,
                    active: item.route == current,
                    onTap: () => onSelected(item.route),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tab extends StatelessWidget {
  const _Tab({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // The active tab is marked by colour alone. #087443 rather than the lighter
    // brand green: at 11px the light green measures 2.14:1 on this white bar,
    // well under what small text needs. This one is 5.85:1.
    final color = active ? AppColors.primaryDark : AppColors.navInactive;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(height: 4),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              letterSpacing: 0.11,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}
