import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/profile_image.dart';
import '../../routing/routes.dart';
import '../../state/auth_controller.dart';
import '../../state/notification_controller.dart';
import 'brand.dart';
import 'controls.dart';

/// The bar at the top of every signed-in screen: the logo, then notifications
/// and the account.
///
/// It replaced a header that was part of the dashboard's scrolling content, so
/// the two things people reach for most -- the unread count and the way into
/// their profile -- slid off the top as soon as anyone looked at anything. A
/// Scaffold's appBar sits outside the body, so this cannot scroll away.
///
/// The logo takes the place of a page title. That is the trade: a compact bar
/// holds a brand or a name, not both, and the tab bar below already says which
/// part of the app you are in. Screens that need to name themselves do it in
/// their own content, where there is room for it.
class BrandAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BrandAppBar({
    super.key,
    this.actions = const [],
    this.showBack,
    this.leading,
  });

  /// Anything this screen wants before the two standard buttons -- a search
  /// toggle, say. They keep their place; notifications and the account are
  /// always the last two, so their position never moves between screens.
  final List<Widget> actions;

  /// Defaults to whether the route can actually be popped, so a pushed screen
  /// gets a back arrow and a tab does not.
  final bool? showBack;

  /// For a screen whose back button does something other than pop -- Pay Bills
  /// steps back to its list of billers before it leaves.
  final Widget? leading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final back = leading;
    final canPop = back != null || (showBack ?? (ModalRoute.of(context)?.canPop ?? false));

    return AppBar(
      backgroundColor: AppColors.background,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      automaticallyImplyLeading: false,
      titleSpacing: canPop ? 0 : 16,
      leading: back ?? (canPop ? const BackButton() : null),
      leadingWidth: canPop ? 44 : null,
      title: const Align(
        alignment: Alignment.centerLeft,
        // Small: the wordmark has a tagline under it, so anything shorter than
        // this turns the second line to mush at toolbar height.
        child: BrandLockup(height: 34),
      ),
      actions: [
        ...actions,
        const _NotificationsButton(),
        const SizedBox(width: 4),
        const _AccountButton(),
        const SizedBox(width: 12),
      ],
    );
  }
}

class _NotificationsButton extends StatelessWidget {
  const _NotificationsButton();

  @override
  Widget build(BuildContext context) {
    // select, not watch: this rebuilds on the count alone, not on every change
    // the controller announces -- and it is on every screen now.
    final unread = context.select<NotificationController, int>(
      (controller) => controller.unreadCount,
    );

    return IconButton(
      tooltip: 'Notifications',
      onPressed: () => Navigator.of(context).pushNamed(Routes.notifications),
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(
            Icons.notifications_none_rounded,
            color: AppColors.textPrimary,
          ),
          if (unread > 0)
            Positioned(
              right: -3,
              top: -3,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                constraints: const BoxConstraints(minWidth: 15),
                height: 15,
                decoration: BoxDecoration(
                  color: AppColors.danger,
                  borderRadius: BorderRadius.circular(999),
                  // Against the bell as well as the bar, so it stays legible
                  // wherever it lands.
                  border: Border.all(color: AppColors.background, width: 1.5),
                ),
                alignment: Alignment.center,
                child: Text(
                  unread > 9 ? '9+' : '$unread',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 9,
                    height: 1,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _AccountButton extends StatelessWidget {
  const _AccountButton();

  @override
  Widget build(BuildContext context) {
    final user = context.select<AuthController, AppUserSnapshot>(
      (auth) => AppUserSnapshot(
        name: auth.user?.name ?? '',
        image: auth.user?.profileImage,
        flagged: auth.user?.autoAdminCashout ?? false,
      ),
    );

    return GestureDetector(
      onTap: () => Navigator.of(context).pushNamed(Routes.profile),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            UserAvatar(
              initials: Fmt.initials(user.name),
              imageProvider: ProfileImage.decode(user.image),
              size: 32,
            ),
            // The same standing warning the dashboard used to carry: admins
            // can currently take cash without asking.
            if (user.flagged)
              Positioned(
                right: -1,
                top: -1,
                child: Container(
                  width: 9,
                  height: 9,
                  decoration: BoxDecoration(
                    color: AppColors.warning,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: AppColors.background,
                      width: 1.5,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Just the parts of the account this bar draws.
///
/// [context.select] compares what it returns, so returning the AppUser itself
/// would rebuild the avatar on every field of it -- a balance arriving over the
/// socket included, which happens constantly and changes nothing here.
class AppUserSnapshot {
  const AppUserSnapshot({
    required this.name,
    required this.image,
    required this.flagged,
  });

  final String name;
  final String? image;
  final bool flagged;

  @override
  bool operator ==(Object other) =>
      other is AppUserSnapshot &&
      other.name == name &&
      other.image == image &&
      other.flagged == flagged;

  @override
  int get hashCode => Object.hash(name, image, flagged);
}
