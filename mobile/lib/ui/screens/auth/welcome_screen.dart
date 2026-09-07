import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/brand.dart';
import '../../widgets/controls.dart';
import 'login_screen.dart';
import 'register_screen.dart';

/// The first screen a new customer sees: what MoneyPay does, then the two ways
/// in.
///
/// Two things this screen has to get right, both learned the hard way:
///
///  * The brand wave is a band along the bottom edge, not a backdrop the
///    content floats over. As a backdrop it ran through the buttons — "Sign In"
///    became green text on a green gradient, invisible and unclickable.
///  * It has to fit. The hero, the feature list and the buttons were sized for
///    a tall phone, so on a short viewport the list was sliced through the
///    middle by the button block. Everything below scales with the room
///    actually available rather than assuming there is plenty.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  static const _features = <({IconData icon, String label, String detail})>[
    (
      icon: Icons.send_rounded,
      label: 'Send Money',
      detail: 'To any MoneyPay number in seconds',
    ),
    (
      icon: Icons.qr_code_rounded,
      label: 'Receive Money',
      detail: 'Share your code and get paid',
    ),
    (
      icon: Icons.payments_outlined,
      label: 'Withdraw Cash',
      detail: 'Through any MoneyPay agent',
    ),
    (
      icon: Icons.history_rounded,
      label: 'Track Everything',
      detail: 'Every transaction, with receipts',
    ),
  ];

  Future<void> _go(BuildContext context, {required bool signIn}) async {
    // Marking onboarding done here rather than on the destination screen means
    // someone who backs out still lands on sign-in next launch, not here again.
    await context.read<AuthController>().completeOnboarding();
    if (!context.mounted) return;

    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => signIn ? const LoginScreen() : const RegisterScreen(),
        settings: RouteSettings(name: signIn ? Routes.login : Routes.register),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            // A short viewport - a small handset, or a desktop browser window
            // that is not very tall - gets the compact arrangement.
            final tight = constraints.maxHeight < 720;

            return Column(
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.fromLTRB(
                      AppSizes.gutter + 2,
                      tight ? 12 : 24,
                      AppSizes.gutter + 2,
                      8,
                    ),
                    // Centred when it fits, scrolled from the top when it does
                    // not. minHeight without a fudge factor is what makes both
                    // true at once: the column is exactly the viewport when the
                    // content is shorter, and exactly the content when longer.
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        minHeight: constraints.maxHeight - 160,
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          BrandLockup(height: tight ? 54 : 66),
                          SizedBox(height: tight ? 18 : 26),
                          Text(
                            'Fast. Secure. Reliable.',
                            style: TextStyle(
                              fontSize: tight ? 17 : 19,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.2,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 5),
                          const Text(
                            'Your money, anytime, anywhere.',
                            style: TextStyle(
                              fontSize: 14,
                              height: 1.4,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          SizedBox(height: tight ? 16 : 24),
                          for (final feature in _features)
                            Padding(
                              padding: EdgeInsets.only(bottom: tight ? 10 : 14),
                              child: _Feature(
                                icon: feature.icon,
                                label: feature.label,
                                detail: feature.detail,
                                compact: tight,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),

                // The call to action, on plain white and clear of any
                // decoration.
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    AppSizes.gutter + 2,
                    4,
                    AppSizes.gutter + 2,
                    tight ? 8 : 12,
                  ),
                  child: Column(
                    children: [
                      PrimaryButton(
                        label: 'Get Started',
                        onPressed: () => _go(context, signIn: false),
                      ),
                      const SizedBox(height: 6),
                      SizedBox(
                        height: 42,
                        width: double.infinity,
                        child: TextButton(
                          onPressed: () => _go(context, signIn: true),
                          child: const Text(
                            'I already have an account',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // Decorative, and the first thing to give up room when the
                // screen is short.
                BrandWave(height: tight ? 44 : 64),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({
    required this.icon,
    required this.label,
    required this.detail,
    required this.compact,
  });

  final IconData icon;
  final String label;
  final String detail;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final box = compact ? 34.0 : 38.0;

    return Row(
      children: [
        Container(
          width: box,
          height: box,
          decoration: BoxDecoration(
            color: AppColors.primaryTint,
            borderRadius: BorderRadius.circular(11),
          ),
          child: Icon(
            icon,
            size: compact ? 17 : 19,
            color: AppColors.primaryDark,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: compact ? 13.5 : 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                detail,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: compact ? 11.5 : 12.5,
                  height: 1.3,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
