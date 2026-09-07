import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';

/// Everything that did not fit in the six Quick Action tiles.
Future<void> showMoreActionsSheet(BuildContext context) {
  final isAgent = context.read<AuthController>().isAgent;

  return showModalBottomSheet<void>(
    context: context,
    // The root navigator, not the shell's nested one. Without this the
    // sheet is mounted inside the shell body, so it stops at the bottom
    // bar - the barrier leaves the bar live and the sheet is clipped
    // short of the screen edge.
    useRootNavigator: true,
    showDragHandle: true,
    builder: (sheetContext) {
      void go(String route) {
        Navigator.of(sheetContext).pop();
        Navigator.of(context).pushNamed(route);
      }

      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            0,
            AppSizes.gutter,
            16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('More', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 4,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 14,
                crossAxisSpacing: 10,
                childAspectRatio: 0.82,
                children: [
                  _Action(
                    icon: Icons.qr_code_rounded,
                    label: 'My QR',
                    onTap: () => go(Routes.receiveQr),
                  ),
                  _Action(
                    icon: Icons.qr_code_scanner_rounded,
                    label: 'Scan',
                    onTap: () => go(Routes.scanQr),
                  ),
                  _Action(
                    icon: Icons.history_rounded,
                    label: 'History',
                    onTap: () => go(Routes.history),
                  ),
                  if (!isAgent)
                    _Action(
                      icon: Icons.pending_actions_rounded,
                      label: 'Approvals',
                      onTap: () => go(Routes.pendingApprovals),
                    ),
                  _Action(
                    icon: Icons.notifications_none_rounded,
                    label: 'Alerts',
                    onTap: () => go(Routes.notifications),
                  ),
                  _Action(
                    icon: Icons.help_outline_rounded,
                    label: 'Help',
                    onTap: () => go(Routes.help),
                  ),
                  _Action(
                    icon: Icons.support_agent_rounded,
                    label: 'Contact',
                    onTap: () => go(Routes.contact),
                  ),
                  _Action(
                    icon: Icons.shield_outlined,
                    label: 'Security',
                    onTap: () => go(Routes.security),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _Action extends StatelessWidget {
  const _Action({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSizes.radiusControl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppColors.primaryTint,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, size: 21, color: AppColors.primary),
          ),
          const SizedBox(height: 7),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
