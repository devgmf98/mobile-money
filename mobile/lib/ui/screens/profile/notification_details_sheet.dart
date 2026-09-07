import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/app_notification.dart';
import '../../widgets/controls.dart';

/// The whole of a notification.
///
/// The list truncates: a withdrawal request's message carries the amount, both
/// fees and the total, and at one line that is exactly the part that gets cut.
/// This shows all of it, plus when it arrived and what it was about.
Future<void> showNotificationDetails(
  BuildContext context,
  AppNotification notification, {
  VoidCallback? onOpenRelated,
}) {
  return showModalBottomSheet<void>(
    context: context,
    // The root navigator, not the shell's nested one. Without this the
    // sheet is mounted inside the shell body, so it stops at the bottom
    // bar - the barrier leaves the bar live and the sheet is clipped
    // short of the screen edge.
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          0,
          AppSizes.gutter,
          20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: notification.kind.tint,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Icon(
                    notification.kind.icon,
                    size: 21,
                    color: notification.kind.color,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        notification.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${Fmt.dayHeading(notification.createdAt)} · '
                        '${Fmt.time(notification.createdAt)}',
                        style: const TextStyle(
                          fontSize: 12.5,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                gradient: AppColors.tileSheen,
                borderRadius: BorderRadius.circular(AppSizes.radiusCard),
                border: Border.all(color: AppColors.divider),
              ),
              child: SelectableText(
                notification.message,
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.55,
                  color: AppColors.textPrimary,
                ),
              ),
            ),

            const SizedBox(height: 14),
            Row(
              children: [
                _Chip(
                  label: notification.kind.label,
                  color: notification.kind.color,
                  tint: notification.kind.tint,
                ),
                const SizedBox(width: 8),
                _Chip(
                  label: notification.isRead ? 'Read' : 'Unread',
                  color: notification.isRead
                      ? AppColors.textSecondary
                      : AppColors.primaryDark,
                  tint: notification.isRead
                      ? AppColors.divider
                      : AppColors.primaryTint,
                ),
              ],
            ),

            const SizedBox(height: 18),
            Text(
              Fmt.dateTime(notification.createdAt),
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),

            const SizedBox(height: 18),
            if (onOpenRelated != null) ...[
              PrimaryButton(
                label: 'View the transaction',
                icon: Icons.receipt_long_rounded,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  onOpenRelated();
                },
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(
                  ClipboardData(
                    text: '${notification.title}\n\n${notification.message}',
                  ),
                );
                AppSnack.info(context, 'Notification copied');
              },
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: const Text('Copy'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.color, required this.tint});

  final String label;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(AppSizes.radiusPill),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}
