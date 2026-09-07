import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/api/api_client.dart';
import '../../../data/models/app_notification.dart';
import '../../../routing/routes.dart';
import '../../../state/notification_controller.dart';
import '../../widgets/controls.dart';
import 'notification_details_sheet.dart';

/// The notification list.
///
/// New ones arrive over the socket while this screen is open, so the list moves
/// on its own — no pull-to-refresh needed for anything that happens while you
/// are looking at it.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<NotificationController>().refresh();
    });
  }

  Future<void> _markAllRead() async {
    try {
      await context.read<NotificationController>().markAllRead();
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    }
  }

  /// Opens the full notification, and marks it read on the way - opening one
  /// is the act that means it has been seen.
  Future<void> _open(AppNotification notification) async {
    final controller = context.read<NotificationController>();
    unawaited(controller.markRead(notification));

    await showNotificationDetails(
      context,
      notification,
      onOpenRelated: notification.relatedTransactionId == null
          ? null
          : () => Navigator.of(context).pushNamed(Routes.history),
    );
  }

  Future<void> _remove(AppNotification notification) async {
    try {
      await context.read<NotificationController>().remove(notification);
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<NotificationController>();

    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Notifications'),
        actions: [
          if (controller.hasUnread)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => controller.refresh(silent: true),
          color: AppColors.primary,
          child: _body(controller),
        ),
      ),
    );
  }

  Widget _body(NotificationController controller) {
    if (controller.isLoading && controller.items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (controller.items.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 60),
          EmptyState(
            icon: Icons.notifications_none_rounded,
            title: controller.error == null
                ? 'Nothing here yet'
                : 'Could not load notifications',
            message:
                controller.error ??
                'Alerts about your money will show up here.',
            action: controller.error == null
                ? null
                : OutlinedButton(
                    onPressed: controller.refresh,
                    child: const Text('Try again'),
                  ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(vertical: 8),
      itemCount: controller.items.length,
      separatorBuilder: (_, _) =>
          const Divider(indent: AppSizes.gutter, endIndent: AppSizes.gutter),
      itemBuilder: (context, index) {
        final notification = controller.items[index];
        return Dismissible(
          key: ValueKey(notification.id),
          direction: DismissDirection.endToStart,
          onDismissed: (_) => _remove(notification),
          background: Container(
            color: AppColors.dangerTint,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: AppSizes.gutter),
            child: const Icon(
              Icons.delete_outline_rounded,
              color: AppColors.danger,
            ),
          ),
          child: _NotificationRow(
            notification: notification,
            onTap: () => _open(notification),
          ),
        );
      },
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.notification, required this.onTap});

  final AppNotification notification;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final unread = !notification.isRead;

    return InkWell(
      onTap: onTap,
      child: Container(
        color: unread ? AppColors.primaryTint.withValues(alpha: 0.35) : null,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.gutter,
          vertical: 14,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: notification.kind.tint,
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(
                notification.kind.icon,
                size: 18,
                color: notification.kind.color,
              ),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          notification.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: unread
                                ? FontWeight.w700
                                : FontWeight.w600,
                          ),
                        ),
                      ),
                      if (unread)
                        Container(
                          width: 8,
                          height: 8,
                          margin: const EdgeInsets.only(left: 8),
                          decoration: const BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notification.message,
                    style: const TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${Fmt.dayHeading(notification.createdAt)} · '
                    '${Fmt.time(notification.createdAt)}',
                    style: const TextStyle(
                      fontSize: 11.5,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
