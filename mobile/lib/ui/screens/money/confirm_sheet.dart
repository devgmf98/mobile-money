import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../widgets/controls.dart';

/// The last look before money moves.
///
/// Every payment passes through here. It restates who is being paid and what
/// the total will be, because those are the two things people get wrong and the
/// two things that cannot be undone afterwards — there is no reversal endpoint
/// in this system.
Future<bool?> showConfirmSheet(
  BuildContext context, {
  required String title,
  required String partyName,
  required String partyDetail,
  required double amount,
  required double totalDebit,
  required String actionLabel,
  String? note,
  String? caution,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    // The root navigator, not the shell's nested one. Without this the
    // sheet is mounted inside the shell body, so it stops at the bottom
    // bar - the barrier leaves the bar live and the sheet is clipped
    // short of the screen edge.
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) => SafeArea(
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
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 18),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.canvas,
                borderRadius: BorderRadius.circular(AppSizes.radiusCard),
              ),
              child: Column(
                children: [
                  _Row(label: 'To', value: partyName, emphasis: true),
                  const SizedBox(height: 10),
                  _Row(label: '', value: partyDetail, muted: true),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Divider(height: 1),
                  ),
                  _Row(label: 'Amount', value: Fmt.money(amount)),
                  if (note != null) ...[
                    const SizedBox(height: 10),
                    _Row(label: 'Note', value: note, muted: true),
                  ],
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 12),
                    child: Divider(height: 1),
                  ),
                  _Row(
                    label: 'Total',
                    value: Fmt.money(totalDebit),
                    emphasis: true,
                  ),
                ],
              ),
            ),

            if (caution != null) ...[
              const SizedBox(height: 14),
              Notice.warning(message: caution),
            ],

            const SizedBox(height: 14),
            const Text(
              'Check the name and number. A completed transfer cannot be '
              'reversed.',
              style: TextStyle(
                fontSize: 12.5,
                height: 1.4,
                color: AppColors.textMuted,
              ),
            ),
            const SizedBox(height: 18),

            PrimaryButton(
              label: actionLabel,
              onPressed: () => Navigator.of(sheetContext).pop(true),
            ),
            const SizedBox(height: 6),
            CancelButton(
              onPressed: () => Navigator.of(sheetContext).pop(false),
            ),
          ],
        ),
      ),
    ),
  );
}

class _Row extends StatelessWidget {
  const _Row({
    required this.label,
    required this.value,
    this.muted = false,
    this.emphasis = false,
  });

  final String label;
  final String value;
  final bool muted;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 74,
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: emphasis ? 16 : 13.5,
              fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500,
              color: muted
                  ? AppColors.textMuted
                  : emphasis
                  ? AppColors.primary
                  : AppColors.textPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
