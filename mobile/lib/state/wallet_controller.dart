import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/api/api_client.dart';
import '../data/api/moneypay_api.dart';
import '../data/models/fee_quote.dart';
import '../data/models/lookup.dart';
import '../core/utils/phone.dart';
import '../data/models/wallet_transaction.dart';
import 'auth_controller.dart';
import '../data/models/app_notification.dart';
import 'realtime_service.dart';

/// The money side of the session: history, totals, and the cash-outs waiting on
/// the customer's approval.
///
/// Balance itself lives on [AuthController] with the rest of the account, so
/// there is one figure rather than two that can disagree; the socket updates
/// that land here are forwarded straight to it.
class WalletController extends ChangeNotifier {
  WalletController({
    required WalletApi api,
    required AuthController auth,
    required RealtimeService realtime,
  }) : _api = api,
       _auth = auth {
    _balanceSubscription = realtime.balanceUpdates.listen((balance) {
      // The balance itself is applied at once - it is the number on screen.
      _auth.applyBalance(balance);

      _scheduleRefresh();
    });

    // A status change moves no money, so no balance event follows it. Same
    // debounce, because an admin editing a row can emit several in a moment.
    _transactionSubscription = realtime.transactionUpdates.listen(
      (_) => _scheduleRefresh(),
    );

    /* A notification means something changed, and for a request it is the only
       thing that says so.

       Raising a cash-out request moves no money and writes no transaction, so
       neither of the streams above fires -- the lists here, including the
       requests waiting on this agent, sat unchanged until someone pulled to
       refresh. The notification is the event; this is what it should have been
       driving all along. */
    _notificationSubscription = realtime.notifications.listen(
      (_) => _scheduleRefresh(),
    );
  }

  void _scheduleRefresh() {
    // Lists are refreshed on a short delay rather than at once. Each refresh is
    // three or four HTTP requests, and settling a cash-out can push several
    // events within a second or two; without this, one counter interaction
    // fired a dozen requests and the dashboard rebuilt through all of them.
    _refreshDebounce?.cancel();
    _refreshDebounce = Timer(
      const Duration(milliseconds: 700),
      () => unawaited(refresh(silent: true)),
    );
  }

  final WalletApi _api;
  final AuthController _auth;
  late final StreamSubscription<double> _balanceSubscription;
  late final StreamSubscription<void> _transactionSubscription;
  late final StreamSubscription<AppNotification> _notificationSubscription;
  Timer? _refreshDebounce;

  List<WalletTransaction> _transactions = const [];
  List<WithdrawalRequestItem> _pending = const [];
  List<AdminCashOutRequest> _adminRequests = const [];
  WalletStats _stats = const WalletStats.empty();

  bool _loading = false;
  bool _loadedOnce = false;
  String? _error;

  List<WalletTransaction> get transactions => _transactions;
  List<WithdrawalRequestItem> get pendingWithdrawals => _pending;

  /// Admin cash-outs waiting on this agent. Always empty for a customer --
  /// only an agent is ever asked to approve one.
  List<AdminCashOutRequest> get adminCashOutRequests => _adminRequests;
  WalletStats get stats => _stats;
  bool get isLoading => _loading;
  bool get hasLoaded => _loadedOnce;
  String? get error => _error;

  /// The last few people money was actually sent to, most recent first.
  ///
  /// De-duplicated by number rather than by name: the same person can appear in
  /// the history as 0912345002 and +211912345002, and showing them twice in a
  /// row of four would waste half of it. Cash-outs are left out — an agent is
  /// somewhere you withdrew, not someone you would think of paying again.
  List<Payee> get recentPayees {
    // Cached against the list it was derived from. The dashboard reads this on
    // every build, and rebuilding a set and a list each time is work done over
    // and over for an answer that only changes when the transactions do.
    final cached = _cachedPayees;
    if (cached != null && identical(_payeesSource, _transactions)) return cached;

    final seen = <String>{};
    final payees = <Payee>[];

    for (final transaction in _transactions) {
      if (transaction.isIncoming || transaction.isWithdrawal) continue;

      final raw = transaction.counterpartyPhone;
      if (raw == null || raw.isEmpty) continue;

      final phone = Phone.normalise(raw);
      if (phone.isEmpty || !seen.add(phone)) continue;

      payees.add(
        Payee(name: transaction.counterpartyName ?? Phone.pretty(phone), phone: phone),
      );
      if (payees.length == 4) break;
    }

    _payeesSource = _transactions;
    _cachedPayees = payees;
    return payees;
  }

  List<Payee>? _cachedPayees;
  List<WalletTransaction>? _payeesSource;

  /// The five most recent rows, for the dashboard's Recent Transactions block.
  List<WalletTransaction> get recent => _transactions.take(5).toList();

  /// Loads everything the dashboard and history screens need.
  ///
  /// `silent` skips the spinner, for refreshes the customer did not ask for —
  /// a socket update, or coming back to the dashboard.
  Future<void> refresh({bool silent = false}) async {
    final viewer = _auth.user;
    if (viewer == null) return;

    if (!silent) {
      _loading = true;
      _error = null;
      notifyListeners();
    }

    // Three independent reads, so they go together rather than in sequence.
    // Each is caught on its own: a failing stats endpoint should not empty the
    // transaction list that loaded perfectly well beside it.
    final results = await Future.wait([
      _api
          .transactions(viewerId: viewer.id)
          .then<Object?>((value) => value, onError: (Object error) => error),
      _api.stats().then<Object?>(
        (value) => value,
        onError: (Object error) => error,
      ),
      _api.pendingWithdrawals().then<Object?>(
        (value) => value,
        onError: (Object error) => error,
      ),
      // Only an agent can be asked to approve an admin cash-out, so a customer
      // is not made to pay for a request that can only ever come back empty.
      if (viewer.role.isAgent)
        _api.adminCashOutRequests().then<Object?>(
          (value) => value,
          onError: (Object error) => error,
        ),
    ]);

    if (results[0] is List<WalletTransaction>) {
      _transactions = results[0] as List<WalletTransaction>;
    }
    if (results[1] is WalletStats) _stats = results[1] as WalletStats;
    if (results[2] is List<WithdrawalRequestItem>) {
      _pending = results[2] as List<WithdrawalRequestItem>;
    }
    if (results.length > 3 && results[3] is List<AdminCashOutRequest>) {
      _adminRequests = results[3] as List<AdminCashOutRequest>;
    }

    // Only report a failure when nothing at all came back — a partial refresh
    // that still filled the screen is not worth an error banner.
    final failures = results.whereType<ApiException>().toList();
    _error = failures.length == results.length ? failures.first.message : null;

    _loading = false;
    _loadedOnce = true;
    notifyListeners();
  }

  // -------------------------------------------------------------- lookups

  Future<PartyInfo> lookupRecipient(String phone) => _api.lookupByPhone(phone);

  Future<AgentInfo> lookupAgent(String agentId) => _api.lookupAgent(agentId);

  Future<FeeQuote> quoteSend({
    required double amount,
    String? recipientPhone,
  }) => _api.sendQuote(amount: amount, recipientPhone: recipientPhone);

  Future<FeeQuote> quoteWithdrawal(double amount) =>
      _api.withdrawalQuote(amount: amount);

  // ------------------------------------------------------------- movements

  /// Returns the `TXN…` reference so the confirmation screen can show it.
  Future<String> sendMoney({
    required String recipientPhone,
    required double amount,
    String? description,
  }) async {
    final reference = await _api.sendMoney(
      recipientPhone: recipientPhone,
      amount: amount,
      description: description,
    );
    await _settle();
    return reference;
  }

  Future<String> withdraw({
    required String agentId,
    required double amount,
  }) async {
    final reference = await _api.withdraw(agentId: agentId, amount: amount);
    await _settle();
    return reference;
  }

  Future<void> approveAdminCashOut(int requestId) async {
    await _api.approveAdminCashOut(requestId);
    await refresh(silent: true);
  }

  Future<void> rejectAdminCashOut(int requestId, {String? reason}) async {
    await _api.rejectAdminCashOut(requestId, reason: reason);
    await refresh(silent: true);
  }

  Future<void> approveWithdrawal(int requestId) async {
    await _api.approveWithdrawal(requestId);
    await _settle();
  }

  Future<void> rejectWithdrawal(int requestId, {String? reason}) async {
    await _api.rejectWithdrawal(requestId, reason: reason);
    await _settle();
  }

  /// Agent side: ask a customer to approve a cash-out.
  Future<void> requestWithdrawalFromCustomer({
    required String userPhone,
    required double amount,
  }) async {
    await _api.requestWithdrawalFromCustomer(
      userPhone: userPhone,
      amount: amount,
    );
    await _settle();
  }

  /// After anything that moves money: re-read the account for the authoritative
  /// balance, then the lists. The socket usually beats this, but it is not
  /// guaranteed to arrive and a wrong balance is the one error nobody forgives.
  Future<void> _settle() async {
    await _auth.refreshProfile();
    await refresh(silent: true);
  }

  void clear() {
    _transactions = const [];
    _pending = const [];
    _stats = const WalletStats.empty();
    _loadedOnce = false;
    _error = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _refreshDebounce?.cancel();
    _balanceSubscription.cancel();
    _transactionSubscription.cancel();
    _notificationSubscription.cancel();
    super.dispose();
  }
}
