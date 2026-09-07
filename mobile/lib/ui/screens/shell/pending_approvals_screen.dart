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

/// Cash-outs an agent or an admin has asked you to approve.
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

class _PendingApprovalsScreenState extends State<PendingApprovalsScreen> {
  int? _working;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<WalletController>().refresh(silent: true);
    });
  }

  Future<void> _approve(WithdrawalRequestItem request) async {
    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.point_of_sale_rounded,
      title: 'Approve this cash-out?',
      message:
          '${Fmt.money(request.totalCost)} will leave your balance now, and '
          'you receive ${Fmt.money(request.amount)} in cash.\n\n'
          'Only approve once ${request.who} has the cash '
          'ready to hand to you.',
      confirmLabel: 'Approve',
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = request.id);
    try {
      await context.read<WalletController>().approveWithdrawal(request.id);
      if (mounted) AppSnack.success(context, 'Cash-out approved.');
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    } finally {
      if (mounted) setState(() => _working = null);
    }
  }

  Future<void> _reject(WithdrawalRequestItem request) async {
    setState(() => _working = request.id);
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
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Approvals'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => wallet.refresh(silent: true),
          color: AppColors.primary,
          child: requests.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
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
                    return _RequestCard(
                      request: request,
                      busy: _working == request.id,
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

class _RequestCard extends StatelessWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.onApprove,
    required this.onReject,
  });

  final WithdrawalRequestItem request;
  final bool busy;
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
                    Text(
                      request.agentName ?? request.requesterLabel,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [
                        request.requesterLabel,
                        if (request.agentCode != null)
                          'ID ${request.agentCode}',
                        if (request.agentPhone != null)
                          Phone.pretty(request.agentPhone),
                      ].join(' · '),
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                Fmt.dayHeading(request.createdAt),
                style: const TextStyle(
                  fontSize: 11.5,
                  color: AppColors.textMuted,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
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
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: busy ? null : onApprove,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(46),
                  ),
                  child: busy
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
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: emphasis ? 13.5 : 12.5,
            fontWeight: emphasis ? FontWeight.w600 : FontWeight.w400,
            color: AppColors.textSecondary,
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: emphasis ? 15 : 13,
            fontWeight: emphasis ? FontWeight.w700 : FontWeight.w500,
            color: emphasis ? AppColors.primary : AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
