import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../widgets/controls.dart';

/// What a completed movement produced, for the receipt screen.
class ReceiptDetails {
  const ReceiptDetails({
    required this.title,
    required this.reference,
    required this.amount,
    required this.total,
    required this.partyLabel,
    required this.partyName,
    required this.partyDetail,
    this.note,
    this.completedAt,
  });

  final String title;

  /// The `TXN…` reference the server generated — the one thing to quote when
  /// something needs chasing up.
  final String reference;
  final double amount;
  final double total;

  /// "To" or "From", depending on which way the money went.
  final String partyLabel;
  final String partyName;
  final String partyDetail;
  final String? note;
  final DateTime? completedAt;

  String get shareText =>
      'MoneyPay receipt\n'
      '$title\n'
      'Reference: $reference\n'
      'Amount: ${Fmt.money(amount)}\n'
      'Total: ${Fmt.money(total)}\n'
      '$partyLabel: $partyName ($partyDetail)\n'
      'Date: ${Fmt.dateTime(completedAt ?? DateTime.now())}';
}

/// The confirmation after money has moved.
class ReceiptScreen extends StatelessWidget {
  const ReceiptScreen({super.key, required this.details});

  final ReceiptDetails details;

  @override
  Widget build(BuildContext context) {
    final when = details.completedAt ?? DateTime.now();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.gutter,
                  30,
                  AppSizes.gutter,
                  20,
                ),
                children: [
                  Center(
                    child: Container(
                      width: 84,
                      height: 84,
                      decoration: const BoxDecoration(
                        color: AppColors.successTint,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: AppColors.success,
                        size: 44,
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(
                    details.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    Fmt.money(details.amount),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.8,
                      color: AppColors.primary,
                    ),
                  ),
                  const SizedBox(height: 28),

                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.canvas,
                      borderRadius: BorderRadius.circular(AppSizes.radiusCard),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      children: [
                        _Line(
                          label: details.partyLabel,
                          value: details.partyName,
                        ),
                        _Line(label: 'Number', value: details.partyDetail),
                        if (details.note != null)
                          _Line(label: 'Note', value: details.note!),
                        const Divider(height: 26),
                        _Line(
                          label: 'Amount',
                          value: Fmt.money(details.amount),
                        ),
                        _Line(
                          label: 'Total charged',
                          value: Fmt.money(details.total),
                          emphasis: true,
                        ),
                        const Divider(height: 26),
                        _Line(
                          label: 'Reference',
                          value: details.reference,
                          copyable: true,
                        ),
                        _Line(label: 'Date', value: Fmt.dateTime(when)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.gutter,
                0,
                AppSizes.gutter,
                18,
              ),
              child: Column(
                children: [
                  OutlinedButton.icon(
                    onPressed: () => AppShare.text(details.shareText),
                    icon: const Icon(Icons.ios_share_rounded, size: 18),
                    label: const Text('Share receipt'),
                  ),
                  const SizedBox(height: 10),
                  PrimaryButton(
                    label: 'Done',
                    onPressed: () =>
                        Navigator.of(context).popUntil((r) => r.isFirst),
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
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 4,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
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
                      fontSize: emphasis ? 15 : 13.5,
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
                        size: 15,
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
