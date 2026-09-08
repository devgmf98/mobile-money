import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../data/models/lookup.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/confirm_dialog.dart';
import '../../widgets/controls.dart';
import '../../../core/theme/motion.dart';
import '../../widgets/brand_app_bar.dart';

/// Withdrawals an agent or an admin has asked you to approve.
///
/// Worded from the customer's side throughout: they are withdrawing cash, and
/// "cash-out" is the agent's word for the other side of the same transaction.
///
/// Approving moves the money immediately, so what leaves the balance is the
/// headline rather than the cash handed over — the two differ by the
/// commission, which is priced by the server and folded in rather than
/// itemised. Rejecting is offered with equal weight, because the safe answer to
/// a request you did not expect is no.
class PendingApprovalsScreen extends StatefulWidget {
  const PendingApprovalsScreen({super.key});

  @override
  State<PendingApprovalsScreen> createState() => _PendingApprovalsScreenState();
}

class _PendingApprovalsScreenState extends State<PendingApprovalsScreen>
    with AfterRouteSettles {
  /* Which row is working, and which of its two buttons started it. Only the
     id was kept before, so the card knew something was in flight but not
     what -- and the spinner was hardcoded onto Approve, so declining a
     request span the button next to the one that had been tapped. */
  ({int id, bool approving})? _working;

  @override
  void initState() {
    super.initState();
    afterRouteSettles(() {
      context.read<WalletController>().refresh(silent: true);
    });
  }

  Future<void> _approve(WithdrawalRequestItem request) async {
    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.point_of_sale_rounded,
      title: 'Approve this withdrawal?',
      message:
          '${Fmt.money(request.totalCost)} will leave your balance now, and '
          'you receive ${Fmt.money(request.amount)} in cash.\n\n'
          'Only approve once ${request.who} has the cash '
          'ready to hand to you.',
      confirmLabel: 'Approve',
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = (id: request.id, approving: true));
    try {
      await context.read<WalletController>().approveWithdrawal(request.id);
      if (mounted) AppSnack.success(context, 'Withdrawal approved.');
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    } finally {
      if (mounted) setState(() => _working = null);
    }
  }

  Future<void> _reject(WithdrawalRequestItem request) async {
    setState(() => _working = (id: request.id, approving: false));
    try {
      await context.read<WalletController>().rejectWithdrawal(
        request.id,
        reason: 'Declined by the customer',
      );
      if (mounted) AppSnack.info(context, 'Request declined.');
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    } finally {
      if (mounted) setState(() => _working = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();
    final requests = wallet.pendingWithdrawals;

    return Scaffold(
      appBar: const BrandAppBar(),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => wallet.refresh(silent: true),
          color: AppColors.primary,
          child: requests.isEmpty
              ? ListView(
                  physics: const BouncingScrollPhysics(
                    parent: AlwaysScrollableScrollPhysics(),
                  ),
                  children: const [
                    SizedBox(height: 60),
                    EmptyState(
                      icon: Icons.task_alt_rounded,
                      title: 'Nothing to approve',
                      message:
                          'When an agent or admin asks to pay you cash, the '
                          'request will appear here for you to approve or '
                          'decline.',
                    ),
                  ],
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(
                    AppSizes.gutter,
                    16,
                    AppSizes.gutter,
                    28,
                  ),
                  itemCount: requests.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 14),
                  itemBuilder: (context, index) {
                    final request = requests[index];
                    return PendingWithdrawalCard(
                      request: request,
                      approving:
                          _working?.id == request.id && _working!.approving,
                      rejecting:
                          _working?.id == request.id && !_working!.approving,
                      onApprove: () => _approve(request),
                      onReject: () => _reject(request),
                    );
                  },
                ),
        ),
      ),
    );
  }
}

/// One request, with the two buttons that answer it.
///
/// Public so a test can pump it: the spinner used to be hardcoded onto
/// Approve, so declining span the wrong button.
class PendingWithdrawalCard extends StatelessWidget {
  const PendingWithdrawalCard({
    super.key,
    required this.request,
    required this.approving,
    required this.rejecting,
    required this.onApprove,
    required this.onReject,
  });

  final WithdrawalRequestItem request;
  final bool approving;
  final bool rejecting;

  /// Either one disables both buttons: two requests against the same row at
  /// once is not something to allow.
  bool get busy => approving || rejecting;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.warningTint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.point_of_sale_rounded,
                  size: 20,
                  color: AppColors.warning,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The date sits on the title's line and nowhere else. It
                    // used to be a third column beside the whole block, which
                    // squeezed the details into a width that broke a phone
                    // number across two lines mid-number.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(
                            request.agentName ?? request.requesterLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          Fmt.dayHeading(request.createdAt),
                          style: const TextStyle(
                            fontSize: 11.5,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        // Dropped when the title is already the role, which
                        // it is both when no name was sent and when the name
                        // itself is "Agent".
                        if (request.roleAside != null) request.roleAside!,
                        if (request.agentCode != null)
                          'ID ${request.agentCode}',
                        if (request.agentPhone != null)
                          Phone.pretty(request.agentPhone),
                      ].join(' · '),
                      style: const TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(AppSizes.radiusControl),
            ),
            child: Column(
              children: [
                _Line('Cash you receive', Fmt.money(request.amount)),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 10),
                  child: Divider(height: 1),
                ),
                _Line(
                  'Leaves your balance',
                  Fmt.money(request.totalCost),
                  emphasis: true,
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: busy ? null : onReject,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    minimumSize: const Size.fromHeight(46),
                  ),
                  child: rejecting
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.danger,
                          ),
                        )
                      : const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onApprove,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(46),
                  ),
                  child: approving
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Approve'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.label, this.value, {this.emphasis = false});

  final String label;
  final String value;
  final bool emphasis;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          flex: 5,
          child: Text(
            label,
            style: TextStyle(
              fontSize: emphasis ? 13.5 : 12.5,
              fontWeight: emphasis ? FontWeight.w600 : FontWeight.w400,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        const SizedBox(width: 12),
        // Given its own share of the row and shrunk to fit inside it, so a
        // large figure can neither run into the label nor overflow the card.
        Expanded(
          flex: 4,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerRight,
            child: Text(
              value,
              maxLines: 1,
              style: TextStyle(
                fontSize: emphasis ? 15 : 13,
                fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500,
                color: emphasis ? AppColors.primary : AppColors.textPrimary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
