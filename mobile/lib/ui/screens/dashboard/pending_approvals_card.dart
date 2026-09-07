import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/lookup.dart';
import '../../../routing/routes.dart';

/// A prompt on the dashboard when an agent has asked for a cash-out.
///
/// Money only moves when the customer approves, so this is not a notice — it is
/// someone at a counter with the notes counted out, waiting. It leads with the
/// total cost rather than the amount, because the fees are what surprise people.
class PendingApprovalsCard extends StatelessWidget {
  const PendingApprovalsCard({super.key, required this.requests});

  final List<WithdrawalRequestItem> requests;

  @override
  Widget build(BuildContext context) {
    final first = requests.first;
    final extra = requests.length - 1;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warningTint,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.pending_actions_rounded,
                size: 19,
                color: AppColors.warning,
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  extra > 0
                      ? '${requests.length} cash-outs need your approval'
                      : 'A cash-out needs your approval',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            // Named, the role goes in brackets after it; unnamed, the role is
            // all there is to say — "Agent (Agent)" is what naming them twice
            // would produce.
            '${first.agentName == null ? first.requesterLabel : '${first.agentName} (${first.requesterLabel})'}'
            ' asked to pay you ${Fmt.money(first.amount)} in cash. '
            'It will cost ${Fmt.money(first.totalCost)} from your balance '
            'including fees.',
            style: const TextStyle(
              fontSize: 13,
              height: 1.45,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          // Compact and right-aligned rather than a full-width amber slab.
          // This is a prompt, not the point of the screen — at full width it
          // outshouted the balance directly above it.
          Align(
            alignment: Alignment.centerLeft,
            child: FilledButton(
              onPressed: () =>
                  Navigator.of(context).pushNamed(Routes.pendingApprovals),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.warning,
                minimumSize: const Size(0, 38),
                padding: const EdgeInsets.symmetric(horizontal: 18),
                textStyle: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
              child: const Text('Review request'),
            ),
          ),
        ],
      ),
    );
  }
}
