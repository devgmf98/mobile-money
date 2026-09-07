import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/phone.dart';
import '../../core/utils/profile_image.dart';
import '../../data/models/fee_quote.dart';
import '../../data/models/lookup.dart';
import '../../data/models/wallet_transaction.dart';

/// The wallet card, matching the web app's redesigned balance card.
///
/// It leads with the currency, sets the figure in tabular numerals so digits
/// do not shift as the balance changes, and carries the real account number in
/// its foot. The balance hides behind an eye toggle because this screen gets
/// opened in public.
class BalanceCard extends StatelessWidget {
  const BalanceCard({
    super.key,
    required this.balance,
    required this.hidden,
    required this.onToggleHidden,
    this.label = 'My Balance',
    this.accountLabel = 'Account',
    this.accountValue,
  });

  final double balance;
  final bool hidden;
  final VoidCallback onToggleHidden;
  final String label;

  /// What the foot is called. A customer's is their account; an agent's is the
  /// six-digit ID customers actually quote, so the caller decides.
  final String accountLabel;

  /// Already formatted. Grouping digits in fours suits an account number and
  /// would mangle a six-digit agent ID, so the shaping belongs to the caller.
  final String? accountValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: AppColors.cardSheen,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.border),
        boxShadow: AppColors.cardLift,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // A faint brand wash in the corner, so the card is not a plain white
          // box. Decorative only, and behind everything.
          Positioned(
            right: -54,
            top: -70,
            child: IgnorePointer(
              child: Container(
                width: 168,
                height: 168,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      Color(0xD9D1F0E3),
                      Color(0xD9E8F7F0),
                      Color(0x00E8F7F0),
                    ],
                    stops: [0, 0.7, 1],
                  ),
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.fromLTRB(22, 20, 22, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        label.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.7,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: onToggleHidden,
                      behavior: HitTestBehavior.opaque,
                      child: Padding(
                        padding: const EdgeInsets.all(4),
                        child: Icon(
                          hidden
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 18,
                          color: AppColors.textMuted,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The currency rides at the cap height of the digits
                    // rather than sitting on their baseline.
                    const Padding(
                      padding: EdgeInsets.only(top: 4, right: 6),
                      child: Text(
                        'SSP',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.4,
                          color: AppColors.primaryDark,
                        ),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        hidden ? '••••••' : Fmt.amount(balance),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w800,
                          height: 1,
                          letterSpacing: -1.2,
                          color: AppColors.textStrong,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ],
                ),

                if (accountValue != null) ...[
                  const SizedBox(height: 18),
                  Text(
                    accountLabel.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.7,
                      color: AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    accountValue!,
                    style: const TextStyle(
                      fontSize: 15.5,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 2.4,
                      color: AppColors.textPrimary,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One of the four tiles under the balance.
class WalletAction {
  const WalletAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

/// The action row: four tiles across, as in the web app.
///
/// All four carry one treatment. They were two ranks once — two solid green,
/// two pale — which read as though the pale pair mattered less. The green now
/// lives in the icon chip, where it marks the action, and every label takes
/// dark ink so it reads against white.
class ActionRow extends StatelessWidget {
  const ActionRow({super.key, required this.actions});

  final List<WalletAction> actions;

  @override
  Widget build(BuildContext context) {
    // IntrinsicHeight, not a stretch Row on its own: stretch needs a bounded
    // height and every caller puts this inside a scroll view, where the height
    // is unbounded and the row throws rather than laying out.
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < actions.length; i++) ...[
            Expanded(child: _ActionTile(action: actions[i])),
            if (i != actions.length - 1) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.action});

  final WalletAction action;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: AppColors.tileSheen,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
        boxShadow: AppColors.tileLift,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: action.onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            constraints: const BoxConstraints(minHeight: 84),
            padding: const EdgeInsets.fromLTRB(6, 12, 6, 11),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: AppColors.primaryTint,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    action.icon,
                    size: 19,
                    color: AppColors.primaryDark,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  action.label,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    height: 1.2,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF0F2A20),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The last few people money was sent to, as round avatars.
///
/// Paying the same handful of people repeatedly is most of what a wallet is
/// used for, and retyping a nine-digit number each time is the slowest part of
/// it. Four is the cap because five stops fitting on a narrow phone without the
/// names truncating to nothing.
class RecentPayeesRow extends StatelessWidget {
  const RecentPayeesRow({super.key, required this.payees, required this.onTap});

  final List<Payee> payees;
  final ValueChanged<Payee> onTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < payees.length; i++) ...[
          Expanded(
            child: _Payee(payee: payees[i], onTap: () => onTap(payees[i])),
          ),
          if (i != payees.length - 1) const SizedBox(width: 8),
        ],
        // Keeps two or three avatars at the same size as four, instead of
        // stretching them across the width.
        for (var i = payees.length; i < 4; i++) ...[
          const SizedBox(width: 8),
          const Spacer(),
        ],
      ],
    );
  }
}

class _Payee extends StatelessWidget {
  const _Payee({required this.payee, required this.onTap});

  final Payee payee;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final picture = ProfileImage.decode(payee.profileImage);

    return Tooltip(
      // The name and number are no longer drawn, so they live here instead —
      // a row of bare initials is unreadable to a screen reader, and "PD" is
      // not enough to be sure who you are about to pay.
      message: '${payee.name} · ${Phone.pretty(payee.phone)}',
      child: Semantics(
        button: true,
        label: 'Send again to ${payee.name}',
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Center(
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: AppColors.primaryTint,
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.border),
                  image: picture == null
                      ? null
                      : DecorationImage(image: picture, fit: BoxFit.cover),
                ),
                alignment: Alignment.center,
                child: picture != null
                    ? null
                    : Text(
                        Fmt.initials(payee.name),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primaryDark,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// A figure with a coloured rail down its left edge.
///
/// The rail colours are the ones the transaction list already uses — red for
/// money leaving, green for money arriving — so the same meaning is carried by
/// the same colour in both places. Commission is neither, so it takes amber.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.label,
    required this.value,
    required this.rail,
  });

  final String label;
  final String value;
  final Color rail;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.tileSheen,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.divider),
        boxShadow: AppColors.tileLift,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 12,
            bottom: 12,
            child: Container(
              width: 3,
              decoration: BoxDecoration(
                color: rail,
                borderRadius: const BorderRadius.horizontal(
                  right: Radius.circular(3),
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppColors.captionStrong,
                  ),
                ),
                const SizedBox(height: 5),
                // Shrunk to fit rather than ellipsised. These tiles are half a
                // screen wide and hold running totals, which are the largest
                // figures in the app: "SSP 12,500,000.00" clipped to
                // "SSP 12,500,00..." is not a smaller number, it is a wrong one.
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    value,
                    maxLines: 1,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.15,
                      color: Color(0xFF0F2A20),
                      fontFeatures: [FontFeature.tabularFigures()],
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

/// One row in a transaction list, as a card.
///
/// Carries more than the list used to: the direction is in the colour of the
/// icon chip rather than only in the sign, anything that is not a completed
/// transaction says so, and an agent sees what they earned on a cash-out. That
/// last one matters — commission is the agent's whole reason for handling the
/// transaction, and it was the one figure their history did not show.
class TransactionTile extends StatelessWidget {
  const TransactionTile({
    super.key,
    required this.transaction,
    this.onTap,
    this.showDate = true,
  });

  final WalletTransaction transaction;
  final VoidCallback? onTap;
  final bool showDate;

  @override
  Widget build(BuildContext context) {
    final incoming = transaction.isIncoming;
    final accent = incoming ? AppColors.success : AppColors.danger;

    // What this row earned the viewer. Only an agent receiving a cash-out has
    // one, which is exactly who needs to see it.
    final commission = incoming ? transaction.agentCommission : 0.0;
    final feePaid = transaction.feePaid;

    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: AppColors.tileSheen,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.divider),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Half the space left after the icon and the gaps. Amounts here
                // run to seven figures, and the amount column used to take
                // whatever width it wanted: "- SSP 12,500,000.00" left the
                // description as "To Pe..." on a narrow phone, or overflowed the
                // row outright. Capped, the description always keeps its half
                // and a long amount shrinks to fit instead of shoving it aside.
                final amountCap = ((constraints.maxWidth - 64) * 0.5).clamp(
                  90.0,
                  double.infinity,
                );

                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.11),
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Icon(transaction.icon, size: 19, color: accent),
                    ),
                    const SizedBox(width: 12),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  transaction.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                              ),
                              if (transaction.status != TxStatus.completed) ...[
                                const SizedBox(width: 6),
                                _StatusChip(status: transaction.status),
                              ],
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                            transaction.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                          if (showDate) ...[
                            const SizedBox(height: 3),
                            Text(
                              '${Fmt.date(transaction.createdAt)} · '
                              '${Fmt.time(transaction.createdAt)}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),

                    ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: amountCap),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          // scaleDown, so ordinary amounts are untouched and only
                          // the ones that would not otherwise fit give up any size.
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            alignment: Alignment.centerRight,
                            child: Text(
                              // One figure: what actually moved. An outgoing
                              // row costs the amount plus the commission, and
                              // showing the amount with the fee beside it made
                              // the row's arithmetic the reader's problem.
                              // feePaid is zero on anything incoming, so this
                              // is just the amount there.
                              Fmt.signedMoney(
                                transaction.amount + feePaid,
                                incoming: incoming,
                              ),
                              maxLines: 1,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: accent,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                              ),
                            ),
                          ),
                          if (commission > 0) ...[
                            const SizedBox(height: 4),
                            _Footnote(
                              label: '+${Fmt.amount(commission)} earned',
                              color: AppColors.primaryDark,
                              tint: AppColors.primaryTint,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final TxStatus status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: status.tint,
        borderRadius: BorderRadius.circular(AppSizes.radiusPill),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          color: status.color,
        ),
      ),
    );
  }
}

/// A small tinted note under the amount — commission earned, or fee paid.
class _Footnote extends StatelessWidget {
  const _Footnote({
    required this.label,
    required this.color,
    required this.tint,
  });

  final String label;
  final Color color;
  final Color tint;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(AppSizes.radiusPill),
      ),
      child: FittedBox(
        fit: BoxFit.scaleDown,
        child: Text(
          label,
          maxLines: 1,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w700,
            color: color,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ),
    );
  }
}

/// The fee preview under an amount field.
///
/// Always rendered from a server quote — the tiers are configurable and the
/// rate changes with the amount, so anything the client worked out itself would
/// eventually disagree with what is charged.
class FeeBreakdown extends StatelessWidget {
  const FeeBreakdown({
    super.key,
    required this.quote,
    this.loading = false,
    this.amountLabel = 'Amount',
  });

  final FeeQuote quote;
  final bool loading;
  final String amountLabel;

  @override
  Widget build(BuildContext context) {
    return AnimatedSize(
      duration: const Duration(milliseconds: 180),
      alignment: Alignment.topCenter,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          gradient: AppColors.tileSheen,
          borderRadius: BorderRadius.circular(AppSizes.radiusCard),
          border: Border.all(color: AppColors.divider),
        ),
        child: Column(
          children: [
            // Amount and total only. The agent and company commissions are
            // priced by the server and folded into the total rather than
            // itemised: what the sender needs to decide is what leaves their
            // balance, and splitting that into three lines invited the
            // question of which of them they could avoid. The difference
            // between the two rows is the whole fee, in plain sight.
            _row(amountLabel, Fmt.money(quote.amount)),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 11),
              child: Divider(height: 1),
            ),
            _row(
              'Total to pay',
              loading ? '…' : Fmt.money(quote.totalDebit),
              emphasis: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _row(
    String label,
    String value, {
    bool muted = false,
    bool emphasis = false,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: emphasis ? 14 : 13,
            fontWeight: emphasis ? FontWeight.w600 : FontWeight.w400,
            color: muted ? AppColors.textMuted : AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: emphasis ? 15 : 13,
            fontWeight: emphasis ? FontWeight.w800 : FontWeight.w500,
            color: emphasis ? AppColors.primaryDark : AppColors.textPrimary,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
    );
  }
}

/// A confirmed party — shown once the server has said who a number belongs to,
/// so a mistyped digit is caught before an amount is entered.
class PartyConfirmation extends StatelessWidget {
  const PartyConfirmation({
    super.key,
    required this.name,
    required this.detail,
    this.badge,
    this.onClear,
  });

  final String name;
  final String detail;
  final String? badge;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primaryTint,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        border: Border.all(color: AppColors.primaryTintStrong),
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: const BoxDecoration(
              color: AppColors.primaryDark,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_rounded,
              color: Colors.white,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14.5,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (badge != null) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primaryDark,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          badge!,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: const TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (onClear != null)
            IconButton(
              onPressed: onClear,
              icon: const Icon(Icons.close_rounded, size: 18),
              color: AppColors.textSecondary,
              visualDensity: VisualDensity.compact,
            ),
        ],
      ),
    );
  }
}
