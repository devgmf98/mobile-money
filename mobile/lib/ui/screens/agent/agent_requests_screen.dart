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

/// Admin cash-outs waiting on this agent.
///
/// The mirror of the customer's Approvals screen, one step further up: there a
/// customer approves an agent taking cash from their wallet, here an agent
/// approves an administrator taking it from theirs. Approving moves the money
/// at once and there is no reversal endpoint, so declining is offered with
/// equal weight and the amount that leaves the balance is the headline.
///
/// No fee breakdown, because this leg carries none — the amount is the whole
/// of it.
class AgentRequestsScreen extends StatefulWidget {
  const AgentRequestsScreen({super.key});

  @override
  State<AgentRequestsScreen> createState() => _AgentRequestsScreenState();
}

class _AgentRequestsScreenState extends State<AgentRequestsScreen>
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

  Future<void> _approve(AdminCashOutRequest request) async {
    final confirmed = await showConfirmDialog(
      context,
      icon: Icons.account_balance_wallet_outlined,
      title: 'Approve this request?',
      message:
          '${Fmt.money(request.amount)} will leave your balance now and go '
          'to ${request.who}.\n\n'
          'Approve once you have handed over the cash. This cannot be '
          'undone.',
      confirmLabel: 'Approve',
    );
    if (confirmed != true || !mounted) return;

    setState(() => _working = (id: request.id, approving: true));
    try {
      await context.read<WalletController>().approveAdminCashOut(request.id);
      if (mounted) AppSnack.success(context, 'Request approved.');
    } on ApiException catch (error) {
      if (mounted) AppSnack.error(context, error.message);
    } finally {
      if (mounted) setState(() => _working = null);
    }
  }

  Future<void> _reject(AdminCashOutRequest request) async {
    setState(() => _working = (id: request.id, approving: false));
    try {
      await context.read<WalletController>().rejectAdminCashOut(
        request.id,
        reason: 'Declined by the agent',
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
    final requests = wallet.adminCashOutRequests;

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
                      icon: Icons.inbox_outlined,
                      title: 'Nothing to approve',
                      message:
                          'When an admin asks to collect cash from your '
                          'float, the request will appear here for you to '
                          'approve or decline.',
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
                    return AdminCashOutRequestCard(
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
class AdminCashOutRequestCard extends StatelessWidget {
  const AdminCashOutRequestCard({
    super.key,
    required this.request,
    required this.approving,
    required this.rejecting,
    required this.onApprove,
    required this.onReject,
  });

  final AdminCashOutRequest request;
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
                  color: AppColors.infoTint,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.account_balance_wallet_outlined,
                  size: 20,
                  color: AppColors.info,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // The date rides on the title's line so the details below
                    // get the full width of the card.
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(
                            request.adminName ?? request.roleLabel,
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
                        if (request.roleAside != null) request.roleAside!,
                        if (request.adminPhone != null)
                          Phone.pretty(request.adminPhone),
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
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            decoration: BoxDecoration(
              color: AppColors.canvas,
              borderRadius: BorderRadius.circular(AppSizes.radiusControl),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'LEAVES YOUR BALANCE',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: AppColors.captionStrong,
                  ),
                ),
                const SizedBox(height: 6),
                // Shrunk rather than clipped: a float top-up runs to seven
                // figures and a truncated amount is a different number.
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(
                    Fmt.money(request.amount),
                    maxLines: 1,
                    style: const TextStyle(
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.4,
                      color: AppColors.primary,
                    ),
                  ),
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
