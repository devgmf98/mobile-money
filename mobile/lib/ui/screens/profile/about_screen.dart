import 'package:flutter/material.dart';

import '../../../core/config/env.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../routing/routes.dart';
import '../../widgets/brand.dart';
import '../../widgets/controls.dart';

/// About MoneyPay.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const BackButton(), title: const Text('About')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.only(bottom: 28),
          children: [
            const SizedBox(height: 24),
            const Center(child: BrandLockup(height: 74)),
            const SizedBox(height: 10),
            const Center(
              child: Text(
                'Version 1.0.0',
                style: TextStyle(fontSize: 13, color: AppColors.textMuted),
              ),
            ),
            const SizedBox(height: 26),

            const Padding(
              padding: EdgeInsets.symmetric(horizontal: AppSizes.gutter),
              child: Text(
                'MoneyPay lets you send and receive money, withdraw cash '
                'through an agent, and keep track of every transaction from '
                'your phone.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            const SizedBox(height: 28),

            SettingsRow(
              icon: Icons.help_outline_rounded,
              label: 'Help Centre',
              onTap: () => Navigator.of(context).pushNamed(Routes.help),
            ),
            SettingsRow(
              icon: Icons.support_agent_rounded,
              label: 'Contact Support',
              onTap: () => Navigator.of(context).pushNamed(Routes.contact),
            ),

            const Divider(indent: AppSizes.gutter, endIndent: AppSizes.gutter),

            const SettingsRow(
              icon: Icons.dns_outlined,
              label: 'Connected to',
              subtitle: Env.apiBaseUrl,
              trailing: SizedBox.shrink(),
            ),

            const SizedBox(height: 30),
            const Center(
              child: Text(
                '© MoneyPay South Sudan',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
