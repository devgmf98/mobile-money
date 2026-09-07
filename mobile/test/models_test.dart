import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/data/models/app_user.dart';
import 'package:moneypay/data/models/fee_quote.dart';
import 'package:moneypay/data/models/app_notification.dart';
import 'package:moneypay/data/models/lookup.dart';
import 'package:moneypay/state/notification_controller.dart';
import 'package:moneypay/data/models/parse.dart';
import 'package:moneypay/data/models/wallet_transaction.dart';

/// The API is Sequelize over MySQL, and mysql2 hands back every DECIMAL column
/// as a string. A balance that arrives as `"125750.00"` and is read as a number
/// is the single most likely way this app shows a wrong figure, so the parsing
/// is pinned down here.
void main() {
  group('P.toDouble', () {
    test('reads a DECIMAL column returned as a string', () {
      expect(P.toDouble('125750.00'), 125750.0);
      expect(P.toDouble('0.00'), 0.0);
    });

    test('reads a plain number unchanged', () {
      expect(P.toDouble(5000), 5000.0);
      expect(P.toDouble(1.5), 1.5);
    });

    test('falls back rather than throwing on nonsense', () {
      expect(P.toDouble(null), 0.0);
      expect(P.toDouble('not a number'), 0.0);
      expect(P.toDouble('', 7), 7.0);
    });
  });

  group('P.toBool', () {
    test('reads the several shapes a flag arrives in', () {
      expect(P.toBool(true), isTrue);
      expect(P.toBool(1), isTrue);
      expect(P.toBool('true'), isTrue);
      expect(P.toBool(0), isFalse);
      expect(P.toBool('false'), isFalse);
    });

    test('uses the given fallback when the value is missing', () {
      expect(P.toBool(null, true), isTrue);
      expect(P.toBool(null), isFalse);
    });
  });

  group('P.toList', () {
    test('reads a bare array', () {
      final rows = P.toList([
        {'id': 1},
        {'id': 2},
      ]);
      expect(rows, hasLength(2));
    });

    test('reads an array wrapped under a named key', () {
      // /withdrawals/pending answers { requests: [...] } rather than an array.
      final rows = P.toList({
        'requests': [
          {'id': 1},
        ],
      }, key: 'requests');
      expect(rows, hasLength(1));
    });

    test('returns empty rather than throwing on an unexpected shape', () {
      expect(P.toList(null), isEmpty);
      expect(P.toList('nope'), isEmpty);
      expect(P.toList({'requests': null}, key: 'requests'), isEmpty);
    });
  });

  group('AppUser', () {
    test('parses a login payload with string decimals', () {
      final user = AppUser.fromJson({
        'id': 7,
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+211912345002',
        'role': 'agent',
        'balance': '125750.00',
        'isVerified': true,
        'agentId': 483920,
      });

      expect(user.balance, 125750.0);
      expect(user.role, UserRole.agent);
      expect(user.role.isAgent, isTrue);
      expect(user.agentId, '483920');
      expect(user.isSuspended, isFalse);
    });

    test('maps the hyphenated sub-admin role', () {
      expect(UserRole.parse('sub-admin'), UserRole.subAdmin);
      expect(UserRole.parse('sub-admin').isStaff, isTrue);
      expect(UserRole.parse(null), UserRole.user);
    });

    test('mergeWith keeps fields the fresher payload omitted', () {
      // /auth/login returns a trimmed account; /auth/profile the full row.
      // Neither should erase what the other knew.
      final cached = AppUser.fromJson({
        'id': 7,
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+211912345002',
        'role': 'user',
        'balance': '100.00',
        'profileImage': 'data:image/jpeg;base64,AAAA',
        'idNumber': 'SS12345',
      });

      final fresher = AppUser.fromJson({
        'id': 7,
        'name': 'John Doe',
        'email': 'john@example.com',
        'phone': '+211912345002',
        'role': 'user',
        'balance': '250.00',
      });

      final merged = cached.mergeWith(fresher);
      expect(merged.balance, 250.0, reason: 'the newer balance wins');
      expect(merged.profileImage, 'data:image/jpeg;base64,AAAA');
      expect(merged.idNumber, 'SS12345');
    });
  });

  group('WalletTransaction', () {
    Map<String, dynamic> transfer({
      required int senderId,
      required int receiverId,
    }) => {
      'id': 1,
      'transactionId': 'TXN123456789',
      'senderId': senderId,
      'receiverId': receiverId,
      'amount': '5000.00',
      'type': 'transfer',
      'status': 'completed',
      'createdAt': '2026-09-04T10:45:00.000Z',
      'companyCommission': '50.00',
      'companyCommissionPercent': '1.00',
      'sender': {'name': 'Mary James', 'phone': '+211912345003'},
      'receiver': {'name': 'Peter Daniel', 'phone': '+211912345004'},
    };

    test('reads as outgoing for the sender', () {
      final tx = WalletTransaction.fromJson(
        transfer(senderId: 7, receiverId: 9),
        viewerId: 7,
      );

      expect(tx.isIncoming, isFalse);
      expect(tx.title, 'Money Sent');
      expect(tx.subtitle, 'To Peter Daniel');
      // The sender pays the amount and every fee on it.
      expect(tx.feePaid, 50.0);
      expect(tx.signedTotal, -5050.0);
    });

    test('reads as incoming for the receiver, with no fee', () {
      final tx = WalletTransaction.fromJson(
        transfer(senderId: 9, receiverId: 7),
        viewerId: 7,
      );

      expect(tx.isIncoming, isTrue);
      expect(tx.title, 'Money Received');
      expect(tx.subtitle, 'From Mary James');
      // Only the sender is charged — the recipient always gets the full amount.
      expect(tx.feePaid, 0.0);
      expect(tx.signedTotal, 5000.0);
    });

    test('phrases a cash-out from each side', () {
      final row = {
        ...transfer(senderId: 7, receiverId: 9),
        'type': 'user_withdraw',
      };

      final customer = WalletTransaction.fromJson(row, viewerId: 7);
      final agent = WalletTransaction.fromJson(row, viewerId: 9);

      expect(customer.title, 'Cash Withdrawal');
      expect(agent.title, 'Cash Paid Out');
      expect(customer.isWithdrawal, isTrue);
    });

    test('sorts into the history filters', () {
      final sent = WalletTransaction.fromJson(
        transfer(senderId: 7, receiverId: 9),
        viewerId: 7,
      );
      final received = WalletTransaction.fromJson(
        transfer(senderId: 9, receiverId: 7),
        viewerId: 7,
      );
      final withdrawal = WalletTransaction.fromJson({
        ...transfer(senderId: 7, receiverId: 9),
        'type': 'user_withdraw',
      }, viewerId: 7);

      expect(sent.matches(TxFilter.sent), isTrue);
      expect(sent.matches(TxFilter.received), isFalse);
      expect(received.matches(TxFilter.received), isTrue);
      expect(withdrawal.matches(TxFilter.withdrawals), isTrue);
      // A withdrawal is not also "sent", or it would be counted twice.
      expect(withdrawal.matches(TxFilter.sent), isFalse);
      expect(withdrawal.matches(TxFilter.all), isTrue);
    });

    test('searches the fields someone would actually search by', () {
      final tx = WalletTransaction.fromJson(
        transfer(senderId: 7, receiverId: 9),
        viewerId: 7,
      );

      expect(tx.matchesQuery('peter'), isTrue);
      expect(tx.matchesQuery('TXN1234'), isTrue);
      expect(tx.matchesQuery('345004'), isTrue);
      expect(tx.matchesQuery(''), isTrue);
      expect(tx.matchesQuery('nobody'), isFalse);
    });

    test('survives a row with no receiver joined in', () {
      final tx = WalletTransaction.fromJson({
        'id': 2,
        'transactionId': 'TXN987',
        'senderId': 7,
        'receiverId': null,
        'amount': '100.00',
        'type': 'topup',
        'status': 'completed',
        'createdAt': '2026-09-04T10:45:00.000Z',
      }, viewerId: 7);

      expect(tx.isIncoming, isFalse);
      expect(tx.subtitle, 'Outgoing transfer');
      expect(tx.reference, 'TXN987');
    });
  });

  group('FeeQuote', () {
    test('parses a withdrawal-tier quote', () {
      final quote = FeeQuote.fromJson({
        'amount': 1000,
        'agentPercent': 2,
        'companyPercent': 1,
        'agentCommission': 20,
        'companyCommission': 10,
        'totalFee': 30,
        'totalDebit': 1030,
        'maxAmount': 970.87,
        'tier': 'withdrawal',
        'recipientRole': 'agent',
        'allowed': true,
      });

      expect(quote.isCashOut, isTrue);
      expect(quote.hasFee, isTrue);
      expect(quote.totalDebit, 1030);
    });

    test('treats a missing allowed flag as permitted', () {
      // Older responses omit it; refusing on absence would block valid sends.
      expect(FeeQuote.fromJson(const {}).allowed, isTrue);
    });

    test('an empty quote charges nothing', () {
      const quote = FeeQuote.empty();
      expect(quote.hasFee, isFalse);
      expect(quote.isCashOut, isFalse);
      expect(quote.totalDebit, 0);
    });
  });

  group('WithdrawalRequestItem', () {
    Map<String, dynamic> raw(String? role) => {
      'id': 12,
      'amount': '5000.00',
      'agentCommission': '100.00',
      'companyCommission': '50.00',
      'createdAt': '2026-09-07T09:15:00.000Z',
      'agent': {
        'name': 'Peter Daniel',
        'phone': '+211912345004',
        'agentId': '483920',
        if (role != null) 'role': role,
      },
    };

    test('calls an admin an admin, not an agent', () {
      // The join is named `agent` whoever raised the request, so the role is
      // the only thing separating "an agent wants to pay you cash" from the
      // same sentence about an administrator.
      expect(
        WithdrawalRequestItem.fromJson(raw('admin')).requesterLabel,
        'Admin',
      );
      expect(
        WithdrawalRequestItem.fromJson(raw('sub-admin')).requesterLabel,
        'Admin',
      );
      expect(
        WithdrawalRequestItem.fromJson(raw('agent')).requesterLabel,
        'Agent',
      );
    });

    test('says agent when the server sends no role', () {
      // A server not yet redeployed with the role in its response. Agents
      // raise nearly all of these, so that is the right thing to assume.
      expect(WithdrawalRequestItem.fromJson(raw(null)).requesterLabel, 'Agent');
    });

    test('does not print the role twice when the name is the role', () {
      // Real accounts are named after their role -- an agent called "Agent" --
      // and the card read "Agent (Agent) asked to pay you...".
      final named = WithdrawalRequestItem.fromJson({
        ...raw('agent'),
        'agent': {'name': 'Agent', 'agentId': '575794', 'role': 'agent'},
      });
      expect(named.requesterLabel, 'Agent');
      expect(named.roleAside, isNull);

      // A different name still gets the role beside it.
      expect(WithdrawalRequestItem.fromJson(raw('admin')).roleAside, 'Admin');

      // And no name means the role is the title, so there is no aside either.
      final anonymous = WithdrawalRequestItem.fromJson({
        ...raw('agent'),
        'agent': {'agentId': '575794', 'role': 'agent'},
      });
      expect(anonymous.roleAside, isNull);
    });

    test('falls back to the role when there is no name', () {
      final named = WithdrawalRequestItem.fromJson(raw('admin'));
      expect(named.who, 'Peter Daniel');

      final anonymous = WithdrawalRequestItem.fromJson({
        ...raw('admin'),
        'agent': {'role': 'admin'},
      });
      expect(anonymous.who, 'the admin');
    });

    test('totals the cash and both fees', () {
      // What actually leaves the balance, which is the figure the screen leads
      // with — the fees are what surprise people.
      expect(WithdrawalRequestItem.fromJson(raw('agent')).totalCost, 5150);
    });
  });

  group('Notification de-duplication', () {
    AppNotification make({
      required int id,
      String title = 'Account Topped Up',
      String message = 'Your account has been topped up with SSP 5000',
      Duration ago = Duration.zero,
    }) => AppNotification(
      id: id,
      title: title,
      message: message,
      kind: NotificationKind.transaction,
      isRead: false,
      createdAt: DateTime.now().subtract(ago),
    );

    test('two identical payments moments apart are both kept', () {
      // The rule used to match on title, message and a 30-second window, so
      // topping the same person up twice for the same amount showed once and
      // the second reached neither the list nor the tray. Two top-ups of 5000
      // in a row is ordinary, not a duplicate.
      final held = [make(id: 101)];
      expect(NotificationController.isDuplicate(held, make(id: 102)), isFalse);
    });

    test('the same notification arriving twice is caught', () {
      // Socket and push both deliver the same row, and both carry its id.
      final held = [make(id: 101)];
      expect(NotificationController.isDuplicate(held, make(id: 101)), isTrue);
    });

    test('a socket payload with no id reports zero, not an invented one', () {
      // The fallback used to invent a positive id from the clock, which made
      // every arrival unique by definition -- so de-duplication matched on the
      // id, never compared the text, and the same event arriving over both the
      // socket and a push showed twice.
      final parsed = AppNotification.fromSocket({
        'title': 'Money Received',
        'message': 'You received SSP 5,000.00',
        'type': 'transaction',
      });
      expect(parsed.id, 0);

      // And a real id is carried through, which is what keeps two separate
      // payments apart in the tray.
      expect(
        AppNotification.fromSocket({
          'id': 4242,
          'title': 'x',
          'message': 'y',
        }).id,
        4242,
      );
    });

    test('without an id it falls back to text and a short window', () {
      // A server that has not been redeployed sends no id.
      final held = [make(id: 0)];
      expect(NotificationController.isDuplicate(held, make(id: 0)), isTrue);
      expect(
        NotificationController.isDuplicate(
          held,
          make(id: 0, message: 'Your account has been topped up with SSP 9000'),
        ),
        isFalse,
      );
      expect(
        NotificationController.isDuplicate(
          held,
          make(id: 0, ago: const Duration(minutes: 5)),
        ),
        isFalse,
      );
    });
  });
}
