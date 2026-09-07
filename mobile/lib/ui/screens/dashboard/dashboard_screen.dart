import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/motion.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/profile_image.dart';
import '../../../data/models/app_user.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../../state/notification_controller.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/wallet_widgets.dart';
import 'pending_approvals_card.dart';

/// The home tab, laid out like the web app's mobile dashboard: a green header,
/// a balance card lifted over it, four actions, the history figures, then the
/// recent transactions.
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.onSeeAllTransactions});

  final VoidCallback? onSeeAllTransactions;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  /// Hidden until asked for. This screen gets opened at a counter, on a bus,
  /// in front of whoever is next in the queue, and the balance is the one thing
  /// on it worth reading over a shoulder. Session-only on purpose: revealing it
  /// once should not leave it showing on the next launch.
  bool _balanceHidden = true;

  Future<void> _refresh() async {
    await Future.wait([
      context.read<AuthController>().refreshProfile(),
      context.read<WalletController>().refresh(silent: true),
      context.read<NotificationController>().refresh(silent: true),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final wallet = context.watch<WalletController>();
    final user = auth.user;

    if (user == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final isAgent = user.role.isAgent;

    return RefreshIndicator(
      onRefresh: _refresh,
      color: AppColors.primaryDark,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 20),
        children: [
          // The card is pulled up into the header, as on the web. The green is
          // split in two rather than overlapped in a Stack sized by the header:
          // the card is taller than the header, so anchoring it to the header's
          // bottom edge made it cover the greeting entirely. This way the
          // header ends 36px below the name, and the last 26px of green sits
          // behind the top of the card - the same result, from layout that
          // cannot depend on which of the two happens to be taller.
          _Header(user: user),
          FadeSlideIn(
            offset: 6,
            child: Stack(
              children: [
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 26,
                  child: DecoratedBox(
                    decoration: const BoxDecoration(
                      gradient: AppColors.headerGradient,
                      borderRadius: BorderRadius.vertical(
                        bottom: Radius.circular(24),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  child: RepaintBoundary(
                    child: BalanceCard(
                      balance: user.balance,
                      hidden: _balanceHidden,
                      onToggleHidden: () =>
                          setState(() => _balanceHidden = !_balanceHidden),
                      // "My Balance" for both, as on the web. What changes is
                      // the identifier beneath it: the web app puts the agent
                      // ID in the same slot the customer's account code
                      // occupies, on the grounds that it is the one a customer
                      // will read back to them at the counter.
                      label: 'My Balance',
                      accountLabel: isAgent && user.agentId != null
                          ? 'Agent ID'
                          : 'Account',
                      accountValue: isAgent && user.agentId != null
                          ? user.agentId
                          : Fmt.accountCode(user.phone),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          if (user.isSuspended)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
              child: Notice.warning(
                message: isAgent
                    ? 'Your agent account is suspended, so cash-outs are '
                          'paused. Contact customer care to restore access.'
                    : 'Your account is suspended, so payments are paused. '
                          'Contact customer care to restore access.',
              ),
            ),

          FadeSlideIn(
            delay: const Duration(milliseconds: 60),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: ActionRow(actions: _actions(context, user)),
            ),
          ),
          const SizedBox(height: 12),

          // Cash-outs an agent has asked this customer to approve. Above the
          // figures because someone is at a counter waiting on it.
          if (wallet.pendingWithdrawals.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: PendingApprovalsCard(requests: wallet.pendingWithdrawals),
            ),
            const SizedBox(height: 12),
          ],

          FadeSlideIn(
            delay: const Duration(milliseconds: 120),
            child: _Section(
              title: 'History',
              child: _Stats(wallet: wallet, isAgent: isAgent),
            ),
          ),

          if (wallet.recentPayees.isNotEmpty)
            FadeSlideIn(
              delay: const Duration(milliseconds: 150),
              child: _Section(
                title: 'Send again',
                child: RecentPayeesRow(
                  payees: wallet.recentPayees,
                  // Straight into the send form with the number filled in, which
                  // is the whole point of the row.
                  onTap: (payee) => Navigator.of(
                    context,
                  ).pushNamed(Routes.sendMoney, arguments: payee.phone),
                ),
              ),
            ),

          FadeSlideIn(
            delay: const Duration(milliseconds: 210),
            child: _Section(
              title: 'Recent Transactions',
              actionLabel: 'See All',
              onAction:
                  widget.onSeeAllTransactions ??
                  () => Navigator.of(context).pushNamed(Routes.history),
              child: _RecentList(wallet: wallet),
            ),
          ),
        ],
      ),
    );
  }

  List<WalletAction> _actions(BuildContext context, AppUser user) {
    final navigator = Navigator.of(context);
    final isAgent = user.role.isAgent;

    // The same four the web app gives each role, in the same order, with the
    // second tile relabelled per role rather than changing what it does. An
    // agent taps it to draw money in from a customer, so it says "Pull Funds":
    // the customer's word for that transaction is "Withdraw" and the receipt
    // calls it "Agent Cash Out", and either on the agent's own dashboard reads
    // as money leaving when it is money arriving. The fourth is admin cash-outs
    // waiting on the agent to approve, which reach them through a different
    // endpoint from a customer's approvals because an admin request puts the
    // agent in the other column. Their ledger moved out of this row to make
    // space: it is on the bottom bar as History and on the profile, and
    // nothing about it needs acting on.
    return [
      WalletAction(
        icon: Icons.send_rounded,
        label: 'Send Money',
        onTap: () => navigator.pushNamed(Routes.sendMoney),
      ),
      isAgent
          ? WalletAction(
              icon: Icons.sync_alt_rounded,
              label: 'Pull Funds',
              onTap: () => navigator.pushNamed(Routes.agentCashOut),
            )
          : WalletAction(
              icon: Icons.payments_outlined,
              label: 'Withdraw',
              onTap: () => navigator.pushNamed(Routes.withdraw),
            ),
      WalletAction(
        icon: Icons.qr_code_rounded,
        label: 'Receive',
        onTap: () => navigator.pushNamed(Routes.receiveQr),
      ),
      isAgent
          ? WalletAction(
              icon: Icons.inbox_rounded,
              label: 'Requests',
              onTap: () => navigator.pushNamed(Routes.agentRequests),
            )
          : WalletAction(
              icon: Icons.schedule_rounded,
              label: 'Pendings',
              onTap: () => navigator.pushNamed(Routes.pendingApprovals),
            ),
    ];
  }
}

/// The green banner: greeting, name, and the two things that have to be
/// reachable from here — notifications and the account.
class _Header extends StatelessWidget {
  const _Header({required this.user});

  final AppUser user;

  ImageProvider? get _picture => ProfileImage.decode(user.profileImage);

  @override
  Widget build(BuildContext context) {
    final unread = context.select<NotificationController, int>(
      (controller) => controller.unreadCount,
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        16,
        MediaQuery.paddingOf(context).top + 22,
        16,
        46,
      ),
      decoration: const BoxDecoration(gradient: AppColors.headerGradient),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Welcome back',
                  style: TextStyle(
                    fontSize: 12,
                    letterSpacing: 0.24,
                    color: Color(0xE6FFFFFF),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  user.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.19,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          _HeaderButton(
            icon: Icons.notifications_none_rounded,
            badge: unread,
            onTap: () => Navigator.of(context).pushNamed(Routes.notifications),
            tooltip: 'Notifications',
          ),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () => Navigator.of(context).pushNamed(Routes.profile),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                UserAvatar(
                  initials: Fmt.initials(user.name),
                  imageProvider: _picture,
                  size: 40,
                  background: const Color(0x2EFFFFFF),
                  foreground: Colors.white,
                ),
                // While admins can take cash without asking, a dot pulses on
                // the way in to the screen that turns it off. It replaced a
                // full-width banner: this is a standing state rather than news,
                // and something that is true every day should not take a
                // paragraph of the dashboard every day.
                if (user.autoAdminCashout)
                  const Positioned(
                    right: -1,
                    top: -1,
                    child: _PulsingDot(),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// A small dot that breathes, for a state worth noticing but not worth
/// interrupting anyone over.
///
/// Only the dot's own opacity animates, inside a RepaintBoundary, so the
/// repeating animation costs one tiny layer per frame and never touches the
/// list it sits above.
class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  late final Animation<double> _fade = Tween<double>(
    begin: 0.35,
    end: 1,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label:
          'Admins can cash out without your approval. Open your profile to '
          'change it.',
      child: Tooltip(
        message: 'Admins can cash out without your approval',
        child: RepaintBoundary(
          child: FadeTransition(
            opacity: _fade,
            child: Container(
              width: 12,
              height: 12,
              decoration: BoxDecoration(
                color: AppColors.warning,
                shape: BoxShape.circle,
                // A ring in the header's own green, so the dot reads as sitting
                // on the avatar rather than behind it.
                border: Border.all(color: AppColors.primaryDark, width: 2),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderButton extends StatelessWidget {
  const _HeaderButton({
    required this.icon,
    required this.onTap,
    required this.tooltip,
    this.badge = 0,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String tooltip;
  final int badge;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Color(0x2EFFFFFF),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 20, color: Colors.white),
            ),
            if (badge > 0)
              Positioned(
                right: -2,
                top: -2,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 5,
                    vertical: 1,
                  ),
                  constraints: const BoxConstraints(minWidth: 18),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    borderRadius: BorderRadius.circular(9),
                    border: Border.all(
                      color: AppColors.primaryDark,
                      width: 1.5,
                    ),
                  ),
                  child: Text(
                    badge > 9 ? '9+' : '$badge',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.child,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final Widget child;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              if (actionLabel != null && onAction != null)
                GestureDetector(
                  onTap: onAction,
                  behavior: HitTestBehavior.opaque,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: 4,
                      horizontal: 2,
                    ),
                    child: Text(
                      actionLabel!,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.primaryDark,
                      ),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          child,
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.wallet, required this.isAgent});

  final WalletController wallet;
  final bool isAgent;

  @override
  Widget build(BuildContext context) {
    if (!wallet.hasLoaded && wallet.isLoading) {
      return const SkeletonStatTiles();
    }

    final stats = wallet.stats;

    final tiles = <StatTile>[
      // Red for money leaving, green for money arriving — the same colours the
      // transaction list uses, so one meaning has one colour throughout.
      StatTile(
        label: 'Money Sent',
        value: Fmt.money(stats.totalSent),
        rail: AppColors.danger,
      ),
      StatTile(
        label: 'Money Received',
        value: Fmt.money(stats.totalReceived),
        rail: AppColors.success,
      ),
      if (isAgent) ...[
        StatTile(
          label: 'Commission Earned',
          value: Fmt.money(stats.commissionEarned),
          rail: AppColors.warning,
        ),
        // Two pending figures, not one, because they move in opposite
        // directions and adding them together would answer nothing. The first
        // is cash coming in once customers approve the pulls this agent
        // raised; the second is cash going out once this agent approves the
        // admins waiting on them.
        //
        // Both are amounts. The old single tile showed pending *commission*,
        // which reads 0.00 whenever no withdrawal tier is configured however
        // many requests are outstanding — a true figure that looked like a bug.
        StatTile(
          label: 'Awaiting Customers',
          value: Fmt.money(stats.pendingCustomerApprovalAmount),
          rail: AppColors.info,
        ),
        StatTile(
          label: 'Admin Requests',
          value: Fmt.money(stats.pendingAdminCashOutAmount),
          rail: AppColors.warning,
        ),
      ],
    ];

    // Two to a row, and a lone last one takes the full width rather than
    // sitting in the left column with a hole beside it.
    final rows = <Widget>[];
    for (var i = 0; i < tiles.length; i += 2) {
      final pair = tiles.skip(i).take(2).toList();

      rows.add(
        pair.length == 1
            // A lone last tile takes the left half and stops there. Dropped
            // bare into the Column it centred itself at its own width, so the
            // odd one out sat inset from every tile above it and lined up with
            // nothing. The empty half holds the column.
            ? Row(
                children: [
                  Expanded(child: pair.first),
                  const SizedBox(width: 10),
                  const Expanded(child: SizedBox.shrink()),
                ],
              )
            : IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Expanded(child: pair[0]),
                    const SizedBox(width: 10),
                    Expanded(child: pair[1]),
                  ],
                ),
              ),
      );
      if (i + 2 < tiles.length) rows.add(const SizedBox(height: 10));
    }

    return Column(children: rows);
  }
}

class _RecentList extends StatelessWidget {
  const _RecentList({required this.wallet});

  final WalletController wallet;

  @override
  Widget build(BuildContext context) {
    // A shimmer in the shape of the rows that are coming, rather than a
    // spinner: the screen keeps its layout, so nothing jumps when the data
    // lands, and it is obvious what is being waited for.
    if (!wallet.hasLoaded && wallet.isLoading) {
      return const SkeletonTransactionList();
    }

    if (wallet.recent.isEmpty) {
      return const EmptyState(
        icon: Icons.receipt_long_outlined,
        title: 'No transactions yet',
        message: 'Money you send and receive will appear here.',
      );
    }

    // A RepaintBoundary per row. Without one the whole block is a single layer,
    // so every card's gradient, border and text repaint together on each frame
    // of a scroll - which is what made this list feel heavy.
    return Column(
      children: [
        for (final transaction in wallet.recent) ...[
          RepaintBoundary(child: TransactionTile(transaction: transaction)),
          if (transaction != wallet.recent.last) const SizedBox(height: 10),
        ],
      ],
    );
  }
}
