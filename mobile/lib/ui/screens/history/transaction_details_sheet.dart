import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/phone.dart';
import '../../../data/models/wallet_transaction.dart';
import '../../widgets/controls.dart';

/// The full record behind a history row.
///
/// Fees are broken out separately from the amount because the two are charged
/// separately and the row above only has space for one figure — this is where
/// "why did SSP 5,050 leave when I sent 5,000" gets answered.
Future<void> showTransactionDetails(
  BuildContext context,
  WalletTransaction transaction,
) {
  return showModalBottomSheet<void>(
    context: context,
    // The root navigator, not the shell's nested one. Without this the
    // sheet is mounted inside the shell body, so it stops at the bottom
    // bar - the barrier leaves the bar live and the sheet is clipped
    // short of the screen edge.
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (sheetContext) {
      final incoming = transaction.isIncoming;

      return SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            0,
            AppSizes.gutter,
            20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 58,
                height: 58,
                decoration: BoxDecoration(
                  color: transaction.accent.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(17),
                ),
                child: Icon(
                  transaction.icon,
                  size: 26,
                  color: transaction.accent,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                transaction.title,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              // The headline of the sheet, at 27px, so it is the first thing to
              // run out of room on a narrow phone. It scales rather than wraps:
              // a money figure broken across two lines is unreadable.
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  Fmt.signedMoney(transaction.amount, incoming: incoming),
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.7,
                    color: incoming ? AppColors.success : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: transaction.status.tint,
                  borderRadius: BorderRadius.circular(AppSizes.radiusPill),
                ),
                child: Text(
                  transaction.status.label,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    color: transaction.status.color,
                  ),
                ),
              ),
              const SizedBox(height: 22),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.canvas,
                  borderRadius: BorderRadius.circular(AppSizes.radiusCard),
                ),
                child: Column(
                  children: [
                    _Line(
                      label: incoming ? 'From' : 'To',
                      value: transaction.counterpartyName ?? '—',
                    ),
                    if (transaction.counterpartyPhone != null)
                      _Line(
                        label: 'Number',
                        value: Phone.pretty(transaction.counterpartyPhone),
                      ),
                    if (transaction.description != null)
                      _Line(label: 'Note', value: transaction.description!),

                    const Divider(height: 24),

                    // Amount and fee as one figure, matching the row this
                    // sheet was opened from. Two lines differing by the
                    // commission only raised the question the commission is no
                    // longer itemised to answer.
                    _Line(
                      label: incoming ? 'Amount' : 'Total charged',
                      value: Fmt.money(
                        transaction.amount + transaction.feePaid,
                      ),
                      emphasis: true,
                    ),

                    const Divider(height: 24),

                    _Line(
                      label: 'Reference',
                      value: transaction.reference,
                      copyable: true,
                    ),
                    _Line(
                      label: 'Date',
                      value: Fmt.dateTime(transaction.createdAt),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: () => AppShare.text(
                  'MoneyPay — ${transaction.title}\n'
                  '${Fmt.money(transaction.amount)}\n'
                  'Reference: ${transaction.reference}\n'
                  'Date: ${Fmt.dateTime(transaction.createdAt)}',
                ),
                icon: const Icon(Icons.ios_share_rounded, size: 18),
                label: const Text('Share details'),
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _Line extends StatelessWidget {
  const _Line({
    required this.label,
    required this.value,
    this.emphasis = false,
    this.copyable = false,
  });

  final String label;
  final String value;
  final bool emphasis;
  final bool copyable;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12.5,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          Expanded(
            flex: 6,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(
                    value,
                    textAlign: TextAlign.right,
                    style: TextStyle(
                      fontSize: emphasis ? 14.5 : 13,
                      fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500,
                      color: emphasis
                          ? AppColors.primary
                          : AppColors.textPrimary,
                    ),
                  ),
                ),
                if (copyable)
                  GestureDetector(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: value));
                      AppSnack.info(context, 'Reference copied');
                    },
                    child: const Padding(
                      padding: EdgeInsets.only(left: 6),
                      child: Icon(
                        Icons.copy_rounded,
                        size: 14,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
