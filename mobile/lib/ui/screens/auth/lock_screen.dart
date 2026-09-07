import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/brand.dart';
import '../../widgets/code_input.dart';
import '../../widgets/controls.dart';

/// The app lock, shown when a PIN is set and the app has been reopened.
///
/// This guards the device, not the account: the session is already on the phone
/// and the server never sees this code. Signing out is always available,
/// because a forgotten PIN must not lock someone out of their own money —
/// signing back in with their password clears it.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  static const _pinLength = 4;

  String _value = '';
  bool _error = false;
  int _attempts = 0;

  Future<void> _onChanged(String value) async {
    setState(() {
      _value = value;
      _error = false;
    });

    if (value.length < _pinLength) return;

    final unlocked = await context.read<AuthController>().unlock(value);
    if (unlocked || !mounted) return;

    HapticFeedback.heavyImpact();
    setState(() {
      _error = true;
      _attempts += 1;
    });

    // Clear after the shake so the wrong code is visibly rejected rather than
    // vanishing the instant it is finished.
    await Future<void>.delayed(const Duration(milliseconds: 450));
    if (mounted) setState(() => _value = '');
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSizes.gutter),
          child: Column(
            children: [
              const Spacer(),
              if (user != null)
                UserAvatar(initials: Fmt.initials(user.name), size: 60)
              else
                const BrandMark(size: 48),
              const SizedBox(height: 18),
              Text(
                'Enter PIN',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 6),
              Text(
                user == null
                    ? 'Enter your four-digit PIN'
                    : 'Welcome back, ${Fmt.firstName(user.name)}',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 34),

              PinPad(
                length: _pinLength,
                value: _value,
                error: _error,
                onChanged: _onChanged,
              ),

              SizedBox(
                height: 24,
                child: _error
                    ? Text(
                        _attempts >= 3
                            ? 'Wrong PIN. Sign out to reset it.'
                            : 'That PIN is not right.',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.danger,
                        ),
                      )
                    : null,
              ),

              const Spacer(),
              TextButton(
                onPressed: () => context.read<AuthController>().signOut(),
                child: const Text('Sign out'),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }
}
