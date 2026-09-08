import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/code_input.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/controls.dart';
import '../../../core/theme/motion.dart';

/// App lock and password.
///
/// The PIN here is the four-digit code the design draws on its security screen.
/// It is a device lock, not an account credential: it never leaves the phone,
/// the server has no PIN column, and forgetting it costs a sign-in rather than
/// access to the account.
class SecurityScreen extends StatefulWidget {
  const SecurityScreen({super.key});

  @override
  State<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends State<SecurityScreen>
    with AfterRouteSettles {
  bool _lockOn = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    afterRouteSettles(_load);
  }

  Future<void> _load() async {
    final enabled = await context.read<AuthController>().hasAppLock;
    if (mounted) {
      setState(() {
        _lockOn = enabled;
        _loading = false;
      });
    }
  }

  Future<void> _toggleLock(bool enable) async {
    final auth = context.read<AuthController>();

    if (!enable) {
      await auth.removeAppLock();
      if (mounted) {
        setState(() => _lockOn = false);
        AppSnack.info(context, 'App lock turned off.');
      }
      return;
    }

    final pin = await _askForPin();
    if (pin == null || !mounted) return;

    await auth.setAppLock(pin);
    if (mounted) {
      setState(() => _lockOn = true);
      AppSnack.success(context, 'App lock is on.');
    }
  }

  /// Asks twice and only accepts a match — a mistyped PIN set once would lock
  /// the app with a code nobody knows.
  Future<String?> _askForPin() {
    return showModalBottomSheet<String>(
      context: context,
      // The root navigator, not the shell's nested one. Without this the
      // sheet is mounted inside the shell body, so it stops at the bottom
      // bar - the barrier leaves the bar live and the sheet is clipped
      // short of the screen edge.
      useRootNavigator: true,
      isScrollControlled: true,
      showDragHandle: true,
      isDismissible: true,
      builder: (_) => const _SetPinSheet(),
    );
  }

  Future<void> _changePin() async {
    final pin = await _askForPin();
    if (pin == null || !mounted) return;
    await context.read<AuthController>().setAppLock(pin);
    if (mounted) AppSnack.success(context, 'PIN changed.');
  }

  Future<void> _resetPassword() async {
    final auth = context.read<AuthController>();
    final email = auth.user?.email;
    if (email == null) return;

    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.password_rounded,
      title: 'Change your password?',
      message:
          'We will text a reset code to the phone number on your account. '
          'You can then set a new password from the sign-in screen.\n\n$email',
      confirmLabel: 'Send code',
    );
    if (confirmed != true || !mounted) return;

    try {
      await auth.forgotPassword(email);
      if (mounted) {
        AppSnack.success(context, 'Reset code sent to your phone.');
      }
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Security'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.only(bottom: 28),
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(
                      AppSizes.gutter,
                      16,
                      AppSizes.gutter,
                      6,
                    ),
                    child: Notice.info(
                      message:
                          'The app lock protects this phone. Your password is '
                          'what protects your account.',
                    ),
                  ),
                  const SizedBox(height: 8),

                  SettingsRow(
                    icon: Icons.lock_outline_rounded,
                    label: 'App Lock (PIN)',
                    subtitle: _lockOn
                        ? 'Asked for each time you reopen MoneyPay'
                        : 'Off — the app opens straight to your balance',
                    trailing: Switch(value: _lockOn, onChanged: _toggleLock),
                  ),
                  if (_lockOn)
                    SettingsRow(
                      icon: Icons.pin_outlined,
                      label: 'Change PIN',
                      onTap: _changePin,
                    ),

                  const Divider(
                    indent: AppSizes.gutter,
                    endIndent: AppSizes.gutter,
                  ),

                  SettingsRow(
                    icon: Icons.password_rounded,
                    label: 'Change Password',
                    subtitle: 'We text a reset code to your phone',
                    onTap: _resetPassword,
                  ),
                  SettingsRow(
                    icon: Icons.logout_rounded,
                    label: 'Sign out of this device',
                    tone: AppColors.danger,
                    trailing: const SizedBox.shrink(),
                    onTap: () => context.read<AuthController>().signOut(),
                  ),
                ],
              ),
            ),
    );
  }
}

/// Enter a new PIN, then repeat it.
class _SetPinSheet extends StatefulWidget {
  const _SetPinSheet();

  @override
  State<_SetPinSheet> createState() => _SetPinSheetState();
}

class _SetPinSheetState extends State<_SetPinSheet> {
  static const _length = 4;

  String _first = '';
  String _second = '';
  bool _confirming = false;
  bool _mismatch = false;

  void _onChanged(String value) {
    setState(() {
      _mismatch = false;
      if (_confirming) {
        _second = value;
      } else {
        _first = value;
      }
    });

    if (value.length < _length) return;

    if (!_confirming) {
      setState(() => _confirming = true);
      return;
    }

    if (_first == _second) {
      Navigator.of(context).pop(_first);
    } else {
      setState(() {
        _mismatch = true;
        _second = '';
        _first = '';
        _confirming = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          0,
          AppSizes.gutter,
          20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              _confirming ? 'Repeat your PIN' : 'Choose a four-digit PIN',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              _mismatch
                  ? 'Those did not match. Start again.'
                  : 'You will enter this each time you reopen the app.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: _mismatch ? AppColors.danger : AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 26),
            PinPad(
              length: _length,
              value: _confirming ? _second : _first,
              error: _mismatch,
              onChanged: _onChanged,
            ),
          ],
        ),
      ),
    );
  }
}
