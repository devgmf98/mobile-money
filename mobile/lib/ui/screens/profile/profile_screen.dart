import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/motion.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/phone.dart';
import '../../../core/utils/profile_image.dart';
import '../../../data/models/app_user.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../../state/notification_controller.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/controls.dart';

/// The account, and everything that hangs off it.
///
/// Grouped into titled cards rather than one long ruled list. The flat list ran
/// Help and Log Out through the same divider as My Profile — an irreversible
/// action a thumb's width from a routine one, with nothing to say where one
/// kind of setting ended and the next began.
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _signOut(BuildContext context) async {
    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.logout_rounded,
      title: 'Sign out?',
      message: 'You will need your email and password to sign back in.',
      confirmLabel: 'Sign out',
      destructive: true,
    );
    if (confirmed != true || !context.mounted) return;

    // Clear the per-session caches before the session itself, so nothing is
    // left holding another account's rows when the next person signs in.
    context.read<WalletController>().clear();
    context.read<NotificationController>().clear();
    await context.read<AuthController>().signOut();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final isAgent = user.role.isAgent;

    return Scaffold(
      backgroundColor: AppColors.canvas,
      body: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          _Header(user: user),
          const SizedBox(height: 18),

          FadeSlideIn(
            child: _Group(
              title: 'Account',
              children: [
                SettingsRow(
                  icon: Icons.person_outline_rounded,
                  label: 'My Profile',
                  subtitle: 'Name, photo and ID number',
                  onTap: () =>
                      Navigator.of(context).pushNamed(Routes.editProfile),
                ),
                SettingsRow(
                  icon: Icons.lock_outline_rounded,
                  label: 'Security & PIN',
                  subtitle: 'App lock and password',
                  onTap: () => Navigator.of(context).pushNamed(Routes.security),
                ),
                SettingsRow(
                  icon: Icons.qr_code_rounded,
                  label: 'My QR Code',
                  subtitle: 'Let someone scan to pay you',
                  onTap: () =>
                      Navigator.of(context).pushNamed(Routes.receiveQr),
                ),
                const _NotificationsRow(),
              ],
            ),
          ),

          FadeSlideIn(
            delay: const Duration(milliseconds: 70),
            child: _Group(
              title: 'Money',
              children: [
                SettingsRow(
                  icon: Icons.history_rounded,
                  label: 'Transaction History',
                  subtitle: 'Everything you have sent and received',
                  onTap: () => Navigator.of(context).pushNamed(Routes.history),
                ),
                SettingsRow(
                  icon: isAgent
                      ? Icons.point_of_sale_rounded
                      : Icons.payments_outlined,
                  label: isAgent ? 'Pull Funds' : 'Withdraw Cash',
                  subtitle: isAgent
                      ? 'Pay a customer and take it from their wallet'
                      : 'Through a MoneyPay agent',
                  onTap: () => Navigator.of(
                    context,
                  ).pushNamed(isAgent ? Routes.agentCashOut : Routes.withdraw),
                ),
                if (!isAgent)
                  SettingsRow(
                    icon: Icons.schedule_rounded,
                    label: 'Approvals',
                    subtitle: 'Withdrawals waiting on you',
                    onTap: () => Navigator.of(
                      context,
                    ).pushNamed(Routes.pendingApprovals),
                  ),
              ],
            ),
          ),

          FadeSlideIn(
            delay: const Duration(milliseconds: 140),
            child: _Group(
              title: 'Support',
              children: [
                SettingsRow(
                  icon: Icons.help_outline_rounded,
                  label: 'Help Centre',
                  onTap: () => Navigator.of(context).pushNamed(Routes.help),
                ),
                SettingsRow(
                  icon: Icons.mail_outline_rounded,
                  label: 'Contact Us',
                  onTap: () => Navigator.of(context).pushNamed(Routes.contact),
                ),
                SettingsRow(
                  icon: Icons.info_outline_rounded,
                  label: 'About MoneyPay',
                  onTap: () => Navigator.of(context).pushNamed(Routes.about),
                ),
              ],
            ),
          ),

          // Set apart, with its own weight. It used to sit in the same ruled
          // list as Help.
          FadeSlideIn(
            delay: const Duration(milliseconds: 200),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: OutlinedButton.icon(
                onPressed: () => _signOut(context),
                icon: const Icon(Icons.logout_rounded, size: 18),
                label: const Text('Log Out'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.danger,
                  backgroundColor: AppColors.surface,
                  side: BorderSide(
                    color: AppColors.danger.withValues(alpha: 0.35),
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 20),
          const Center(
            child: Text(
              'MoneyPay South Sudan · v1.0.0',
              style: TextStyle(fontSize: 11.5, color: AppColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

/// A titled card of rows.
class _Group extends StatelessWidget {
  const _Group({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title.toUpperCase(),
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.7,
                color: AppColors.captionStrong,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: AppColors.tileSheen,
              borderRadius: BorderRadius.circular(AppSizes.radiusCard),
              border: Border.all(color: AppColors.divider),
              boxShadow: AppColors.tileLift,
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  children[i],
                  if (i != children.length - 1)
                    const Divider(height: 1, indent: 54, endIndent: 16),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NotificationsRow extends StatelessWidget {
  const _NotificationsRow();

  @override
  Widget build(BuildContext context) {
    final unread = context.select<NotificationController, int>(
      (controller) => controller.unreadCount,
    );

    return SettingsRow(
      icon: Icons.notifications_none_rounded,
      label: 'Notifications',
      subtitle: unread > 0 ? '$unread unread' : 'Alerts about your money',
      onTap: () => Navigator.of(context).pushNamed(Routes.notifications),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (unread > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.danger,
                borderRadius: BorderRadius.circular(9),
              ),
              child: Text(
                unread > 9 ? '9+' : '$unread',
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
          const SizedBox(width: 6),
          const Icon(
            Icons.chevron_right_rounded,
            size: 20,
            color: AppColors.textMuted,
          ),
        ],
      ),
    );
  }
}

/// The green banner: who you are, and how you are identified to other people.
class _Header extends StatelessWidget {
  const _Header({required this.user});

  final AppUser user;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        12,
        MediaQuery.paddingOf(context).top + 8,
        12,
        26,
      ),
      decoration: const BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(26)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => Navigator.of(context).maybePop(),
                icon: const Icon(Icons.arrow_back_rounded),
                color: Colors.white,
                tooltip: 'Back',
              ),
              const Expanded(
                child: Text(
                  'Profile',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
              IconButton(
                onPressed: () =>
                    Navigator.of(context).pushNamed(Routes.editProfile),
                icon: const Icon(Icons.edit_outlined, size: 20),
                color: Colors.white,
                tooltip: 'Edit profile',
              ),
            ],
          ),
          const SizedBox(height: 6),

          Stack(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.22),
                ),
                child: UserAvatar(
                  initials: Fmt.initials(user.name),
                  imageProvider: ProfileImage.decode(user.profileImage),
                  size: 84,
                  background: const Color(0x33FFFFFF),
                  foreground: Colors.white,
                ),
              ),
              if (user.isVerified && !user.isSuspended)
                Positioned(
                  right: 2,
                  bottom: 2,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: AppColors.primaryDark,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      size: 12,
                      color: Colors.white,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),

          Text(
            user.name,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            Phone.pretty(user.phone),
            style: const TextStyle(fontSize: 13, color: Color(0xD9FFFFFF)),
          ),

          const SizedBox(height: 12),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            alignment: WrapAlignment.center,
            children: [
              if (user.isSuspended)
                const _Badge(
                  icon: Icons.block_rounded,
                  label: 'Suspended',
                  background: AppColors.danger,
                )
              else
                _Badge(
                  icon: user.isVerified
                      ? Icons.verified_rounded
                      : Icons.error_outline_rounded,
                  label: user.isVerified ? 'Verified' : 'Unverified',
                  background: const Color(0x33FFFFFF),
                ),
              _Badge(
                icon: user.role.isAgent
                    ? Icons.storefront_rounded
                    : Icons.person_rounded,
                label: user.role.isAgent
                    ? 'Agent ${user.agentId ?? ''}'.trim()
                    : 'Personal',
                background: const Color(0x33FFFFFF),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({
    required this.icon,
    required this.label,
    required this.background,
  });

  final IconData icon;
  final String label;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppSizes.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}
