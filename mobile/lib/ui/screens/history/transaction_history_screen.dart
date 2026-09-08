import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../data/models/wallet_transaction.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/skeleton.dart';
import '../../widgets/wallet_widgets.dart';
import 'transaction_details_sheet.dart';

/// Everything that has moved, newest first, grouped by day.
///
/// The API returns the fifty most recent rows and has no pagination, so this is
/// the whole of what can be shown; filtering and searching happen on what is
/// already here rather than round-tripping.
class TransactionHistoryScreen extends StatefulWidget {
  const TransactionHistoryScreen({super.key, this.embedded = false});

  /// True when shown as a tab inside the home shell, which supplies its own
  /// chrome and bottom padding.
  final bool embedded;

  @override
  State<TransactionHistoryScreen> createState() =>
      _TransactionHistoryScreenState();
}

class _TransactionHistoryScreenState extends State<TransactionHistoryScreen> {
  final _search = TextEditingController();
  TxFilter _filter = TxFilter.all;
  bool _searching = false;

  @override
  void initState() {
    super.initState();
    if (!widget.embedded) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<WalletController>().refresh(silent: true);
      });
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  /// Flattens the rows into headings and transactions, in order.
  ///
  /// Returns data rather than widgets so the list can be built lazily. It used
  /// to return a `List<Widget>` handed to `ListView(children:)`, which builds
  /// and lays out every row up front — fifty transactions plus their day
  /// headings, all constructed before the first frame, on a screen where four
  /// are visible.
  List<Object> _flatten(List<WalletTransaction> transactions) {
    final rows = <Object>[];
    String? currentHeading;

    for (final transaction in transactions) {
      final heading = Fmt.dayHeading(transaction.createdAt);
      if (heading != currentHeading) {
        currentHeading = heading;
        rows.add(heading);
      }
      rows.add(transaction);
    }

    return rows;
  }

  @override
  Widget build(BuildContext context) {
    final wallet = context.watch<WalletController>();

    final visible = wallet.transactions
        .where((t) => t.matches(_filter) && t.matchesQuery(_search.text))
        .toList(growable: false);

    final body = Column(
      children: [
        Padding(
          /* No horizontal inset here any more: the filter strip below scrolls,
             and a scroller that starts and stops inside the gutter looks cut
             off at both ends. Its own padding puts the chips where the gutter
             would have, while letting them run to the screen edge as they
             move. The search field keeps the inset of its own. */
          padding: const EdgeInsets.fromLTRB(0, 4, 0, 10),
          child: Column(
            children: [
              if (_searching) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSizes.gutter,
                  ),
                  child: TextField(
                  controller: _search,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: 'Search by name, number or reference',
                    prefixIcon: const Icon(Icons.search_rounded, size: 19),
                    suffixIcon: IconButton(
                      onPressed: () => setState(() {
                        _search.clear();
                        _searching = false;
                      }),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      color: AppColors.textMuted,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TxFilterBar(
                value: _filter,
                onChanged: (filter) => setState(() => _filter = filter),
              ),
            ],
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            onRefresh: () => wallet.refresh(silent: true),
            color: AppColors.primary,
            child: _Body(
              wallet: wallet,
              visible: visible,
              searching: _search.text.isNotEmpty,
              filter: _filter,
              rows: _flatten(visible),
            ),
          ),
        ),
      ],
    );

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        leading: widget.embedded ? null : const BackButton(),
        title: const Text('Transaction History'),
        actions: [
          IconButton(
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) _search.clear();
            }),
            icon: Icon(
              _searching ? Icons.search_off_rounded : Icons.search_rounded,
            ),
            tooltip: 'Search',
          ),
        ],
      ),
      body: SafeArea(bottom: false, child: body),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({
    required this.wallet,
    required this.visible,
    required this.searching,
    required this.filter,
    required this.rows,
  });

  final WalletController wallet;
  final List<WalletTransaction> visible;
  final bool searching;
  final TxFilter filter;
  final List<Object> rows;

  @override
  Widget build(BuildContext context) {
    if (!wallet.hasLoaded && wallet.isLoading) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          4,
          AppSizes.gutter,
          28,
        ),
        children: const [SkeletonTransactionList(count: 7)],
      );
    }

    if (wallet.error != null && wallet.transactions.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 40),
          EmptyState(
            icon: Icons.cloud_off_rounded,
            title: 'Could not load your history',
            message: wallet.error!,
            action: OutlinedButton(
              onPressed: wallet.refresh,
              child: const Text('Try again'),
            ),
          ),
        ],
      );
    }

    if (visible.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const SizedBox(height: 30),
          EmptyState(
            icon: searching
                ? Icons.search_off_rounded
                : Icons.receipt_long_outlined,
            title: searching
                ? 'Nothing matched'
                : filter == TxFilter.all
                ? 'No transactions yet'
                : 'Nothing under ${filter.label}',
            message: searching
                ? 'Try a different name, number or reference.'
                : 'Money you send and receive will appear here.',
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSizes.gutter,
        0,
        AppSizes.gutter,
        28,
      ),
      itemCount: rows.length,
      itemBuilder: (context, index) {
        final row = rows[index];

        if (row is String) {
          return Padding(
            padding: EdgeInsets.only(top: index == 0 ? 4 : 18, bottom: 4),
            child: Text(
              row,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.textMuted,
              ),
            ),
          );
        }

        final transaction = row as WalletTransaction;
        return Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: TransactionTile(
            transaction: transaction,
            onTap: () => showTransactionDetails(context, transaction),
          ),
        );
      },
    );
  }
}

/// The row of filters above the list.
///
/// Scrollable, and each chip is as wide as its own word. The four used to be
/// Expanded siblings in a Row, splitting the width evenly whatever they had to
/// say -- so "Withdrawals", the longest by some way, was ellipsised to
/// "Withdraw..." in a quarter that "All" left half empty. Sizing each to its
/// label and letting the strip scroll means a filter is never named only in
/// part, and more of them can be added later without taking width from the
/// rest.
///
/// Its own horizontal padding rather than the header's: a scroller that starts
/// and stops inside the gutter looks cut off at both ends, so this puts the
/// chips where the gutter would while letting them run to the screen edge as
/// they move.
class TxFilterBar extends StatelessWidget {
  const TxFilterBar({super.key, required this.value, required this.onChanged});

  final TxFilter value;
  final ValueChanged<TxFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: AppSizes.gutter),
      child: Row(
        children: [
          for (final filter in TxFilter.values) ...[
            _FilterChip(
              label: filter.label,
              active: value == filter,
              onTap: () => onChanged(filter),
            ),
            if (filter != TxFilter.values.last) const SizedBox(width: 8),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primary : AppColors.canvas,
      borderRadius: BorderRadius.circular(AppSizes.radiusPill),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusPill),
        child: Container(
          height: 36,
          alignment: Alignment.center,
          /* Enough that the shortest label still reads as a pill rather than
             a badge, and the longest is not pressed against the edge. */
          constraints: const BoxConstraints(minWidth: 68),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            label,
            maxLines: 1,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w600,
              color: active ? Colors.white : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
