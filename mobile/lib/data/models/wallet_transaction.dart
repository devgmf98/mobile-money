import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'parse.dart';

/// The transaction kinds the `Transactions.type` enum can hold. The exchange
/// and destination-push kinds are produced by the admin console; a customer
/// never creates one, but an agent settling with the company can be on the
/// receiving end of one, so they still have to render.
enum TxKind {
  transfer,
  topup,
  withdrawal,
  userWithdraw,
  agentDeposit,
  agentCashOut,
  adminPush,
  adminStatePush,
  moneyExchange,
  unknown;

  static TxKind parse(Object? raw) => switch (raw?.toString()) {
    'transfer' => TxKind.transfer,
    'topup' => TxKind.topup,
    'withdrawal' => TxKind.withdrawal,
    'user_withdraw' => TxKind.userWithdraw,
    'agent_deposit' => TxKind.agentDeposit,
    'agent_cash_out_money' => TxKind.agentCashOut,
    'admin_push' => TxKind.adminPush,
    'admin_state_push' => TxKind.adminStatePush,
    'money_exchange' => TxKind.moneyExchange,
    _ => TxKind.unknown,
  };
}

enum TxStatus {
  pending,
  completed,
  failed,
  cancelled;

  static TxStatus parse(Object? raw) => switch (raw?.toString()) {
    'completed' => TxStatus.completed,
    'failed' => TxStatus.failed,
    'cancelled' => TxStatus.cancelled,
    _ => TxStatus.pending,
  };

  String get label => switch (this) {
    TxStatus.pending => 'Pending',
    TxStatus.completed => 'Completed',
    TxStatus.failed => 'Failed',
    TxStatus.cancelled => 'Cancelled',
  };

  Color get color => switch (this) {
    TxStatus.pending => AppColors.warning,
    TxStatus.completed => AppColors.success,
    TxStatus.failed => AppColors.danger,
    TxStatus.cancelled => AppColors.textMuted,
  };

  Color get tint => switch (this) {
    TxStatus.pending => AppColors.warningTint,
    TxStatus.completed => AppColors.successTint,
    TxStatus.failed => AppColors.dangerTint,
    TxStatus.cancelled => AppColors.divider,
  };
}

/// The bucket a transaction falls into on the history screen's filter row.
enum TxFilter {
  all('All'),
  sent('Sent'),
  received('Received'),
  withdrawals('Withdrawals');

  const TxFilter(this.label);
  final String label;
}

/// One row of the transactions table, read from the point of view of the
/// signed-in account.
///
/// Direction is not a column — the same row is money out for its sender and
/// money in for its receiver — so [viewerId] decides how it reads, and every
/// display getter is derived from that.
class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.reference,
    required this.senderId,
    required this.receiverId,
    required this.amount,
    required this.kind,
    required this.status,
    required this.createdAt,
    required this.viewerId,
    this.description,
    this.senderName,
    this.senderPhone,
    this.receiverName,
    this.receiverPhone,
    this.agentCommission = 0,
    this.agentCommissionPercent = 0,
    this.companyCommission = 0,
    this.companyCommissionPercent = 0,
    this.senderBalance,
    this.receiverBalance,
  });

  final int id;

  /// The human-facing `TXN…` reference printed on receipts.
  final String reference;
  final int senderId;
  final int? receiverId;
  final double amount;
  final TxKind kind;
  final TxStatus status;
  final DateTime createdAt;
  final String? description;

  final String? senderName;
  final String? senderPhone;
  final String? receiverName;
  final String? receiverPhone;

  final double agentCommission;
  final double agentCommissionPercent;
  final double companyCommission;
  final double companyCommissionPercent;
  final double? senderBalance;
  final double? receiverBalance;

  /// Whose ledger this row is being read from.
  final int viewerId;

  factory WalletTransaction.fromJson(
    Map<String, dynamic> json, {
    required int viewerId,
  }) {
    final sender = P.toMap(json['sender']);
    final receiver = P.toMap(json['receiver']);

    return WalletTransaction(
      id: P.toInt(json['id']),
      reference: P.toText(json['transactionId'], '—'),
      senderId: P.toInt(json['senderId']),
      receiverId: P.toIntOrNull(json['receiverId']),
      amount: P.toDouble(json['amount']),
      kind: TxKind.parse(json['type']),
      status: TxStatus.parse(json['status']),
      createdAt: P.toDate(json['createdAt']),
      description: P.toTextOrNull(json['description']),
      senderName: P.toTextOrNull(sender?['name']),
      senderPhone: P.toTextOrNull(sender?['phone']),
      receiverName: P.toTextOrNull(receiver?['name']),
      receiverPhone: P.toTextOrNull(receiver?['phone']),
      agentCommission: P.toDouble(json['agentCommission']),
      agentCommissionPercent: P.toDouble(json['agentCommissionPercent']),
      companyCommission: P.toDouble(json['companyCommission']),
      companyCommissionPercent: P.toDouble(json['companyCommissionPercent']),
      senderBalance: json['senderBalance'] == null
          ? null
          : P.toDouble(json['senderBalance']),
      receiverBalance: json['receiverBalance'] == null
          ? null
          : P.toDouble(json['receiverBalance']),
      viewerId: viewerId,
    );
  }

  /// Money arriving rather than leaving. A row where the viewer is both sides
  /// cannot happen — the server refuses a transfer to yourself — so testing the
  /// receiver alone is enough.
  bool get isIncoming => receiverId != null && receiverId == viewerId;

  /// The fee the viewer actually paid. Only the sender is charged; the agent's
  /// share of a cash-out is credited to the agent, not taken from them.
  double get feePaid => isIncoming ? 0 : agentCommission + companyCommission;

  /// What left or entered the viewer's balance in total.
  double get signedTotal => isIncoming ? amount : -(amount + feePaid);

  String? get counterpartyName => isIncoming ? senderName : receiverName;
  String? get counterpartyPhone => isIncoming ? senderPhone : receiverPhone;

  /// The bold line in a transaction row — phrased from the viewer's side, which
  /// is why `user_withdraw` reads as a withdrawal to the customer and as cash
  /// paid out to the agent who handled it.
  String get title => switch (kind) {
    TxKind.transfer => isIncoming ? 'Money Received' : 'Money Sent',
    TxKind.topup => 'Wallet Top-up',
    TxKind.withdrawal ||
    TxKind.userWithdraw => isIncoming ? 'Cash Paid Out' : 'Cash Withdrawal',
    TxKind.agentDeposit => isIncoming ? 'Deposit Received' : 'Deposit Made',
    TxKind.agentCashOut => 'Agent Cash-out',
    TxKind.adminPush => isIncoming ? 'Money Received' : 'Money Sent',
    TxKind.adminStatePush => 'Destination Transfer',
    TxKind.moneyExchange => 'Money Exchange',
    TxKind.unknown => isIncoming ? 'Money Received' : 'Money Sent',
  };

  /// The grey line beneath it: who the money moved between.
  String get subtitle {
    final name = counterpartyName;
    final phone = counterpartyPhone;
    if (name != null && name.isNotEmpty) {
      return isIncoming ? 'From $name' : 'To $name';
    }
    if (phone != null && phone.isNotEmpty) {
      return isIncoming ? 'From $phone' : 'To $phone';
    }
    if (description != null) return description!;
    return isIncoming ? 'Incoming transfer' : 'Outgoing transfer';
  }

  IconData get icon => switch (kind) {
    TxKind.transfer || TxKind.adminPush || TxKind.unknown =>
      isIncoming ? Icons.south_west_rounded : Icons.north_east_rounded,
    TxKind.topup => Icons.add_circle_outline_rounded,
    TxKind.withdrawal ||
    TxKind.userWithdraw ||
    TxKind.agentCashOut => Icons.account_balance_wallet_outlined,
    TxKind.agentDeposit => Icons.savings_outlined,
    TxKind.adminStatePush => Icons.local_shipping_outlined,
    TxKind.moneyExchange => Icons.currency_exchange_rounded,
  };

  Color get accent => isIncoming ? AppColors.success : AppColors.primary;

  bool matches(TxFilter filter) => switch (filter) {
    TxFilter.all => true,
    TxFilter.sent => !isIncoming && !isWithdrawal,
    TxFilter.received => isIncoming && !isWithdrawal,
    TxFilter.withdrawals => isWithdrawal,
  };

  bool get isWithdrawal =>
      kind == TxKind.withdrawal ||
      kind == TxKind.userWithdraw ||
      kind == TxKind.agentCashOut;

  /// Free-text search over the fields someone would actually search by.
  bool matchesQuery(String query) {
    final needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return [
      reference,
      title,
      counterpartyName,
      counterpartyPhone,
      description,
      amount.toStringAsFixed(2),
    ].any((field) => (field ?? '').toLowerCase().contains(needle));
  }
}
