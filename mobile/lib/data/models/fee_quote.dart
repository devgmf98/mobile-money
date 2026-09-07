import 'parse.dart';

/// What a transfer will actually cost, priced by the server.
///
/// Fees are tiered and the tiers are configurable by an admin, so the app must
/// never compute them itself — it asks `/transactions/send-quote` or
/// `/transactions/withdrawal-quote` and shows what comes back. The same helper
/// prices the charge on the server, so the figure previewed and the figure
/// taken cannot drift apart.
class FeeQuote {
  const FeeQuote({
    required this.amount,
    required this.agentPercent,
    required this.companyPercent,
    required this.agentCommission,
    required this.companyCommission,
    required this.totalFee,
    required this.totalDebit,
    required this.maxAmount,
    this.tier,
    this.recipientRole,
    this.allowed = true,
  });

  const FeeQuote.empty()
    : amount = 0,
      agentPercent = 0,
      companyPercent = 0,
      agentCommission = 0,
      companyCommission = 0,
      totalFee = 0,
      totalDebit = 0,
      maxAmount = 0,
      tier = null,
      recipientRole = null,
      allowed = true;

  final double amount;
  final double agentPercent;
  final double companyPercent;
  final double agentCommission;
  final double companyCommission;

  /// Everything charged on top of the amount.
  final double totalFee;

  /// Amount plus fees — what actually leaves the sender's balance.
  final double totalDebit;

  /// The largest amount this balance can cover once fees are added. Powers the
  /// "Send all" affordance, which the client cannot work out on its own because
  /// the rate changes with the tier.
  final double maxAmount;

  /// `send` or `withdrawal` — paying an agent is a cash-out and is priced on
  /// the withdrawal tier even though the customer used the send form.
  final String? tier;
  final String? recipientRole;

  /// False when the server will refuse this pairing outright: agent-to-agent,
  /// or anyone paying an admin.
  final bool allowed;

  factory FeeQuote.fromJson(Map<String, dynamic> json) {
    return FeeQuote(
      amount: P.toDouble(json['amount']),
      agentPercent: P.toDouble(json['agentPercent']),
      companyPercent: P.toDouble(json['companyPercent']),
      agentCommission: P.toDouble(json['agentCommission']),
      companyCommission: P.toDouble(json['companyCommission']),
      totalFee: P.toDouble(json['totalFee']),
      totalDebit: P.toDouble(json['totalDebit']),
      maxAmount: P.toDouble(json['maxAmount']),
      tier: P.toTextOrNull(json['tier']),
      recipientRole: P.toTextOrNull(json['recipientRole']),
      allowed: P.toBool(json['allowed'], true),
    );
  }

  bool get hasFee => totalFee > 0;

  /// True when the recipient is an agent, which makes this a cash-out.
  bool get isCashOut => tier == 'withdrawal' || recipientRole == 'agent';
}

/// The counters behind `/transactions/stats`.
class WalletStats {
  const WalletStats({
    required this.totalTransactions,
    required this.totalSent,
    required this.totalReceived,
    required this.commissionEarned,
    required this.pendingAgentCommission,
  });

  const WalletStats.empty()
    : totalTransactions = 0,
      totalSent = 0,
      totalReceived = 0,
      commissionEarned = 0,
      pendingAgentCommission = 0;

  final int totalTransactions;
  final double totalSent;
  final double totalReceived;

  /// Agent earnings from cash-outs they have handled.
  final double commissionEarned;

  /// Commission on requests a customer has not approved yet, so an agent can
  /// see what is still in flight.
  final double pendingAgentCommission;

  factory WalletStats.fromJson(Map<String, dynamic> json) {
    return WalletStats(
      totalTransactions: P.toInt(json['totalTransactions']),
      totalSent: P.toDouble(json['totalSent']),
      totalReceived: P.toDouble(json['totalReceived']),
      commissionEarned: P.toDouble(json['commissionEarned']),
      pendingAgentCommission: P.toDouble(json['pendingAgentCommission']),
    );
  }
}
