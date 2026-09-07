import '../models/app_notification.dart';
import '../models/app_user.dart';
import '../models/fee_quote.dart';
import '../models/lookup.dart';
import '../models/parse.dart';
import '../models/wallet_transaction.dart';
import 'api_client.dart';

/// What a successful sign-in yields.
class AuthResult {
  const AuthResult({required this.token, required this.user});

  final String token;
  final AppUser user;
}

/// Everything under `/api/auth`.
class AuthApi {
  const AuthApi(this._client);

  final ApiClient _client;

  /// The server authenticates on email and password. The mockup draws a phone
  /// field, but there is no phone-based login endpoint and inventing one in the
  /// client would just fail against the real API — so the form asks for the
  /// credential the account actually has.
  Future<AuthResult> login({required String email, required String password}) {
    return _client.post<AuthResult>(
      '/auth/login',
      body: {'email': email.trim(), 'password': password},
      parse: (data) {
        final map = P.toMap(data) ?? const {};
        final user = P.toMap(map['user']);
        if (user == null) {
          throw const ApiException('Sign-in did not return an account.');
        }
        return AuthResult(
          token: P.toText(map['token']),
          user: AppUser.fromJson(user),
        );
      },
    );
  }

  /// Creates a customer or agent account. An agent ID is generated server-side
  /// when the role is `agent` and none is supplied.
  Future<Map<String, dynamic>> register({
    required String name,
    required String email,
    required String phone,
    required String password,
    required String role,
  }) {
    return _client.post<Map<String, dynamic>>(
      '/auth/register',
      body: {
        'name': name.trim(),
        'email': email.trim(),
        'phone': phone.trim(),
        'password': password,
        'role': role,
      },
      parse: (data) => P.toMap(data) ?? const {},
    );
  }

  Future<void> verifyPhone({required String phone, required String code}) {
    return _client.post<void>(
      '/auth/verify-phone',
      body: {'phone': phone, 'code': code},
      parse: (_) {},
    );
  }

  Future<void> resendVerification(String phone) {
    return _client.post<void>(
      '/auth/resend-verification',
      body: {'phone': phone},
      parse: (_) {},
    );
  }

  Future<void> forgotPassword(String email) {
    return _client.post<void>(
      '/auth/forgot-password',
      body: {'email': email.trim()},
      parse: (_) {},
    );
  }

  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) {
    return _client.post<void>(
      '/auth/reset-password',
      body: {'email': email.trim(), 'code': code.trim(), 'password': password},
      parse: (_) {},
    );
  }

  Future<AppUser> profile() {
    return _client.get<AppUser>(
      '/auth/profile',
      parse: (data) => AppUser.fromJson(P.toMap(data) ?? const {}),
    );
  }

  /// Where to push this account's notifications. Sent after sign-in and on
  /// every token rotation, since Firebase reissues on reinstall and restore.
  Future<void> registerDeviceToken(
    String token, {
    String platform = 'android',
    String? deviceName,
  }) {
    return _client.post<void>(
      '/auth/device-token',
      body: {
        'token': token,
        'platform': platform,
        if (deviceName != null) 'deviceName': deviceName,
      },
      parse: (_) {},
    );
  }

  /// Hands the device back on sign-out, so this phone stops receiving the
  /// notifications of whoever was signed in a moment ago.
  Future<void> removeDeviceToken(String token) {
    return _client.delete<void>(
      '/auth/device-token',
      body: {'token': token},
      parse: (_) {},
    );
  }

  Future<AppUser> updateProfile({
    String? name,
    String? profileImage,
    String? idNumber,
    bool? autoAdminCashout,
  }) {
    return _client.put<AppUser>(
      '/auth/profile',
      body: {
        if (name != null) 'name': name.trim(),
        if (profileImage != null) 'profileImage': profileImage,
        if (idNumber != null) 'idNumber': idNumber.trim(),
        if (autoAdminCashout != null) 'autoAdminCashout': autoAdminCashout,
      },
      parse: (data) => AppUser.fromJson(P.toMap(data) ?? const {}),
    );
  }
}

/// Everything under `/api/transactions` and `/api/withdrawals`.
class WalletApi {
  const WalletApi(this._client);

  final ApiClient _client;

  Future<List<WalletTransaction>> transactions({required int viewerId}) {
    return _client.get<List<WalletTransaction>>(
      '/transactions/transactions',
      parse: (data) => P
          .toList(data, key: 'transactions')
          .map((row) => WalletTransaction.fromJson(row, viewerId: viewerId))
          .toList(growable: false),
    );
  }

  Future<WalletStats> stats() {
    return _client.get<WalletStats>(
      '/transactions/stats',
      parse: (data) => WalletStats.fromJson(P.toMap(data) ?? const {}),
    );
  }

  /// Confirms who owns a number before an amount is typed.
  Future<PartyInfo> lookupByPhone(String phone) {
    return _client.get<PartyInfo>(
      '/transactions/user-info/${Uri.encodeComponent(phone)}',
      parse: (data) => PartyInfo.fromJson(P.toMap(data) ?? const {}),
    );
  }

  /// Confirms an agent by the six-digit code on their badge.
  Future<AgentInfo> lookupAgent(String agentId) {
    return _client.get<AgentInfo>(
      '/transactions/agent-info/${Uri.encodeComponent(agentId)}',
      parse: (data) => AgentInfo.fromJson(P.toMap(data) ?? const {}),
    );
  }

  /// Prices a transfer. The recipient's number is passed as soon as the form
  /// has one, because paying an agent is charged on the withdrawal tier.
  Future<FeeQuote> sendQuote({required double amount, String? recipientPhone}) {
    return _client.get<FeeQuote>(
      '/transactions/send-quote',
      query: {'amount': amount, 'recipientPhone': recipientPhone},
      parse: (data) => FeeQuote.fromJson(P.toMap(data) ?? const {}),
    );
  }

  Future<FeeQuote> withdrawalQuote({required double amount}) {
    return _client.get<FeeQuote>(
      '/transactions/withdrawal-quote',
      query: {'amount': amount},
      parse: (data) => FeeQuote.fromJson(P.toMap(data) ?? const {}),
    );
  }

  Future<String> sendMoney({
    required String recipientPhone,
    required double amount,
    String? description,
  }) {
    return _client.post<String>(
      '/transactions/send-money',
      body: {
        'recipientPhone': recipientPhone,
        'amount': amount,
        if (description != null && description.trim().isNotEmpty)
          'description': description.trim(),
      },
      parse: (data) {
        final tx = P.toMap(P.toMap(data)?['transaction']);
        return P.toText(tx?['transactionId'], '—');
      },
    );
  }

  Future<String> withdraw({required String agentId, required double amount}) {
    return _client.post<String>(
      '/transactions/withdraw',
      body: {'agentId': agentId, 'amount': amount},
      parse: (data) {
        final tx = P.toMap(P.toMap(data)?['transaction']);
        return P.toText(tx?['transactionId'], '—');
      },
    );
  }

  /// Cash-outs an agent has asked this customer to approve.
  Future<List<WithdrawalRequestItem>> pendingWithdrawals() {
    return _client.get<List<WithdrawalRequestItem>>(
      '/withdrawals/pending',
      parse: (data) => P
          .toList(data, key: 'requests')
          .map(WithdrawalRequestItem.fromJson)
          .toList(growable: false),
    );
  }

  Future<void> approveWithdrawal(int requestId) {
    return _client.post<void>(
      '/withdrawals/approve',
      body: {'requestId': requestId},
      parse: (_) {},
    );
  }

  Future<void> rejectWithdrawal(int requestId, {String? reason}) {
    return _client.post<void>(
      '/withdrawals/reject',
      body: {'requestId': requestId, if (reason != null) 'reason': reason},
      parse: (_) {},
    );
  }

  /// Agent side: admin cash-outs waiting on this agent.
  ///
  /// A different endpoint from `/withdrawals/pending`, and it has to be: that
  /// one answers from the customer's side, filtering on the userId column,
  /// and an admin request puts the agent in the agentId column instead. An
  /// agent would never see these through the customer endpoint.
  Future<List<AdminCashOutRequest>> adminCashOutRequests() {
    return _client.get<List<AdminCashOutRequest>>(
      '/admin/agent-withdrawal-requests',
      parse: (data) => P
          .toList(data, key: 'requests')
          .map(AdminCashOutRequest.fromJson)
          .toList(growable: false),
    );
  }

  Future<void> approveAdminCashOut(int requestId) {
    return _client.post<void>(
      '/admin/approve-withdrawal-request',
      body: {'requestId': requestId},
      parse: (_) {},
    );
  }

  Future<void> rejectAdminCashOut(int requestId, {String? reason}) {
    return _client.post<void>(
      '/admin/reject-withdrawal-request',
      body: {'requestId': requestId, if (reason != null) 'reason': reason},
      parse: (_) {},
    );
  }

  /// Agent side: ask a customer to approve a cash-out. The money only moves
  /// when they accept, which is why the agent has no "take" endpoint.
  Future<void> requestWithdrawalFromCustomer({
    required String userPhone,
    required double amount,
  }) {
    return _client.post<void>(
      '/withdrawals/request',
      body: {'userPhone': userPhone, 'amount': amount},
      parse: (_) {},
    );
  }
}

/// Everything under `/api/notifications`.
class NotificationApi {
  const NotificationApi(this._client);

  final ApiClient _client;

  Future<List<AppNotification>> list() {
    return _client.get<List<AppNotification>>(
      '/notifications',
      parse: (data) => P
          .toList(data, key: 'notifications')
          .map(AppNotification.fromJson)
          .toList(growable: false),
    );
  }

  Future<void> markRead(int id) => _client.post<void>(
    '/notifications/mark-as-read',
    body: {'notificationId': id},
    parse: (_) {},
  );

  Future<void> markAllRead() =>
      _client.post<void>('/notifications/mark-all-as-read', parse: (_) {});

  Future<void> remove(int id) =>
      _client.delete<void>('/notifications/$id', parse: (_) {});
}

/// Help centre and Contact Us — both readable and writable without a session,
/// so someone locked out can still get in touch.
class SupportApi {
  const SupportApi(this._client);

  final ApiClient _client;

  /// The server groups articles by category; the app flattens them and keeps
  /// the label, because a phone screen browses better as one searchable list.
  Future<List<HelpArticle>> helpArticles({String? search}) {
    return _client.get<List<HelpArticle>>(
      '/help',
      query: {'search': search},
      parse: (data) {
        final categories = P.toList(data, key: 'categories');
        return [
          for (final category in categories)
            ...P.toList(category['articles']).map(HelpArticle.fromJson),
        ];
      },
    );
  }

  Future<void> markHelpRead(String slug) => _client.post<void>(
    '/help/${Uri.encodeComponent(slug)}/read',
    parse: (_) {},
  );

  Future<void> sendMessage({
    required String name,
    required String email,
    required String message,
    String? phone,
    String subject = 'general',
  }) {
    return _client.post<void>(
      '/contact',
      body: {
        'name': name.trim(),
        'email': email.trim(),
        'message': message.trim(),
        'subject': subject,
        if (phone != null && phone.trim().isNotEmpty) 'phone': phone.trim(),
      },
      parse: (_) {},
    );
  }
}
