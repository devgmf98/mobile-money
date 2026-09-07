import 'parse.dart';

/// Who you are about to pay, confirmed by the server before an amount is typed.
///
/// From `/transactions/user-info/:phoneNumber`. The send form shows the name it
/// returns so a mistyped digit is caught by a human reading "that is not who I
/// meant" rather than by a reversal afterwards.
class PartyInfo {
  const PartyInfo({
    required this.id,
    required this.name,
    required this.phone,
    required this.role,
    required this.isVerified,
    required this.isSuspended,
  });

  final int id;
  final String name;
  final String phone;
  final String role;
  final bool isVerified;
  final bool isSuspended;

  factory PartyInfo.fromJson(Map<String, dynamic> json) {
    return PartyInfo(
      id: P.toInt(json['id']),
      name: P.toText(json['name'], 'MoneyPay user'),
      phone: P.toText(json['phone']),
      role: P.toText(json['role'], 'user'),
      isVerified: P.toBool(json['isVerified'], true),
      isSuspended: P.toBool(json['isSuspended']),
    );
  }

  bool get isAgent => role == 'agent';
}

/// An agent identified by the six-digit ID on their badge, from
/// `/transactions/agent-info/:agentId`.
///
/// Deliberately thinner than [PartyInfo] — the server returns only the name and
/// number a customer would verify face to face, never a balance or an email.
class AgentInfo {
  const AgentInfo({
    required this.agentId,
    required this.name,
    required this.phone,
    required this.isSuspended,
  });

  final String agentId;
  final String name;
  final String phone;
  final bool isSuspended;

  factory AgentInfo.fromJson(Map<String, dynamic> json) {
    return AgentInfo(
      agentId: P.toText(json['agentId']),
      name: P.toText(json['name'], 'Agent'),
      phone: P.toText(json['phone']),
      isSuspended: P.toBool(json['isSuspended']),
    );
  }
}

/// A cash-out an agent has asked a customer to approve.
///
/// `/withdrawals/pending` answers from the customer's side only — these are the
/// requests waiting on *your* approval, each one an agent standing at a counter
/// with the cash counted out.
class WithdrawalRequestItem {
  const WithdrawalRequestItem({
    required this.id,
    required this.amount,
    required this.agentCommission,
    required this.companyCommission,
    required this.createdAt,
    this.agentName,
    this.agentPhone,
    this.agentCode,
    this.requesterRole,
  });

  final int id;
  final double amount;
  final double agentCommission;
  final double companyCommission;
  final DateTime createdAt;
  final String? agentName;
  final String? agentPhone;
  final String? agentCode;

  /// Who asked: `agent`, `admin` or `sub-admin`.
  ///
  /// The join is named `agent` for historical reasons, but an admin can raise
  /// one of these too, and calling an administrator "the agent" in a message
  /// about someone taking money out of an account is worse than merely wrong.
  final String? requesterRole;

  factory WithdrawalRequestItem.fromJson(Map<String, dynamic> json) {
    final agent = P.toMap(json['agent']);
    return WithdrawalRequestItem(
      id: P.toInt(json['id']),
      amount: P.toDouble(json['amount']),
      agentCommission: P.toDouble(json['agentCommission']),
      companyCommission: P.toDouble(json['companyCommission']),
      createdAt: P.toDate(json['createdAt']),
      agentName: P.toTextOrNull(agent?['name']),
      agentPhone: P.toTextOrNull(agent?['phone']),
      agentCode: P.toTextOrNull(agent?['agentId']),
      requesterRole: P.toTextOrNull(agent?['role']),
    );
  }

  /// What to call whoever raised this, in a sentence.
  ///
  /// Falls back to "agent" when the role is missing, which is what a server
  /// that has not been redeployed with the role in its response will send —
  /// and is the right guess, since agents raise nearly all of these.
  String get requesterLabel => switch (requesterRole) {
    'admin' || 'sub-admin' => 'Admin',
    _ => 'Agent',
  };

  /// How to refer to the requester in running text: their name if the server
  /// sent one, otherwise "the agent" / "the admin".
  String get who => agentName ?? 'the ${requesterLabel.toLowerCase()}';

  /// What approving actually costs — the cash handed over plus both fees.
  double get totalCost => amount + agentCommission + companyCommission;

  double get totalFee => agentCommission + companyCommission;
}

/// One question and answer from the help centre, `/help`.
class HelpArticle {
  const HelpArticle({
    required this.id,
    required this.slug,
    required this.category,
    required this.categoryLabel,
    required this.question,
    required this.answer,
  });

  final int id;
  final String slug;
  final String category;
  final String categoryLabel;
  final String question;
  final String answer;

  factory HelpArticle.fromJson(Map<String, dynamic> json) {
    return HelpArticle(
      id: P.toInt(json['id']),
      slug: P.toText(json['slug']),
      category: P.toText(json['category'], 'general'),
      categoryLabel: P.toText(json['categoryLabel'], 'Help'),
      question: P.toText(json['question']),
      answer: P.toText(json['answer']),
    );
  }

  bool matchesQuery(String query) {
    final needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    return question.toLowerCase().contains(needle) ||
        answer.toLowerCase().contains(needle);
  }
}

/// Someone money has been sent to, for the dashboard's "send again" row.
class Payee {
  const Payee({required this.name, required this.phone, this.profileImage});

  final String name;

  /// Normalised, so the same person typed two different ways is one entry.
  final String phone;

  /// Their picture, when there is one to have.
  ///
  /// Always null at present, and not an oversight: no endpoint gives another
  /// account's picture. The transaction list joins only `{name, phone}` onto
  /// sender and receiver, and `/transactions/user-info` returns the name, phone,
  /// balance, email and role — no profileImage. The field exists so this row
  /// starts showing faces the moment the API offers them, without touching the
  /// widget.
  final String? profileImage;
}
