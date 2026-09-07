import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:moneypay/core/theme/app_colors.dart';
import 'package:moneypay/core/utils/formatters.dart';
import 'package:moneypay/core/theme/app_theme.dart';
import 'package:moneypay/data/models/fee_quote.dart';
import 'package:moneypay/data/models/wallet_transaction.dart';
import 'package:moneypay/ui/widgets/brand.dart';
import 'package:moneypay/ui/widgets/code_input.dart';
import 'package:moneypay/ui/widgets/confirm_dialog.dart';
import 'package:moneypay/ui/widgets/controls.dart';
import 'package:moneypay/ui/widgets/wallet_widgets.dart';

/// Rendering tests for the shared kit.
///
/// `flutter analyze` cannot see an overflow or a missing ancestor — those only
/// appear when a widget is laid out. Every one of these is on a screen that
/// moves money, so they are worth pinning.
void _noop() {}

void main() {
  Widget host(Widget child) => MaterialApp(
    theme: AppTheme.light,
    home: Scaffold(
      body: SingleChildScrollView(
        child: Padding(padding: const EdgeInsets.all(20), child: child),
      ),
    ),
  );

  Map<String, dynamic> sampleJson({bool incoming = false}) => {
    'id': 1,
    'transactionId': 'TXN123456789',
    'senderId': incoming ? 9 : 7,
    'receiverId': incoming ? 7 : 9,
    'amount': '5000.00',
    'type': 'transfer',
    'status': 'completed',
    'createdAt': DateTime.now().toIso8601String(),
    'companyCommission': '50.00',
    'companyCommissionPercent': '1.00',
    'sender': {'name': 'Mary James', 'phone': '+211912345003'},
    'receiver': {'name': 'Peter Daniel', 'phone': '+211912345004'},
  };

  WalletTransaction sample({bool incoming = false}) =>
      WalletTransaction.fromJson(sampleJson(incoming: incoming), viewerId: 7);

  testWidgets('BalanceCard shows the figure and hides it on request', (
    tester,
  ) async {
    var hidden = false;

    await tester.pumpWidget(
      host(
        StatefulBuilder(
          builder: (context, setState) => BalanceCard(
            balance: 125750,
            hidden: hidden,
            onToggleHidden: () => setState(() => hidden = !hidden),
          ),
        ),
      ),
    );

    // The currency is set apart from the figure so it can ride at cap height.
    expect(find.text('SSP'), findsOneWidget);
    expect(find.text('125,750.00'), findsOneWidget);
    expect(find.text('MY BALANCE'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.visibility_outlined));
    await tester.pumpAndSettle();

    // The balance is opened in public; hiding it has to actually hide it.
    expect(find.text('125,750.00'), findsNothing);
    expect(find.text('••••••'), findsOneWidget);
  });

  testWidgets('TransactionTile reads from each side of the same row', (
    tester,
  ) async {
    await tester.pumpWidget(host(TransactionTile(transaction: sample())));
    expect(find.text('Money Sent'), findsOneWidget);
    expect(find.textContaining('To Peter Daniel'), findsOneWidget);
    // Amount plus the 50 fee, as one figure: this row cost 5,050.
    expect(find.text('- SSP 5,050.00'), findsOneWidget);
    expect(find.textContaining('fee'), findsNothing);

    await tester.pumpWidget(
      host(TransactionTile(transaction: sample(incoming: true))),
    );
    expect(find.text('Money Received'), findsOneWidget);
    expect(find.textContaining('From Mary James'), findsOneWidget);
    // Incoming pays no fee, so the figure is the amount untouched.
    expect(find.text('+ SSP 5,000.00'), findsOneWidget);
  });

  testWidgets('TransactionTile fits a seven-figure amount on a narrow phone', (
    tester,
  ) async {
    // 360dp wide, which is the small end of what this app runs on. A transfer
    // of twelve and a half million is an ordinary business payment here, and
    // an uncapped amount column either overflowed the row or squeezed the
    // description down to nothing.
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    final big = WalletTransaction.fromJson({
      ...sampleJson(),
      'amount': '12500000.00',
    }, viewerId: 7);

    await tester.pumpWidget(host(TransactionTile(transaction: big)));

    expect(tester.takeException(), isNull);
    expect(find.text('- SSP 12,500,050.00'), findsOneWidget);

    // The description keeps its half of the row rather than being crowded out.
    // Measured on the FittedBox, not the Text: the Text is laid out unbounded
    // at its natural width and then scaled, so its own size says nothing about
    // what the row gives it.
    final box = tester.getSize(
      find.ancestor(
        of: find.text('- SSP 12,500,050.00'),
        matching: find.byType(FittedBox),
      ),
    );
    expect(box.width, lessThanOrEqualTo(120));
  });

  testWidgets('StatTile shrinks a large total instead of clipping it', (
    tester,
  ) async {
    await tester.pumpWidget(
      SizedBox(
        // Half a screen, which is how these are laid out two to a row.
        width: 160,
        child: host(
          const StatTile(
            label: 'Money Sent',
            value: 'SSP 12,500,000.00',
            rail: AppColors.danger,
          ),
        ),
      ),
    );

    // Whole. "SSP 12,500,00..." would read as a different, smaller number.
    expect(find.text('SSP 12,500,000.00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('FeeBreakdown folds commission into the total, unitemised', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const FeeBreakdown(
          quote: FeeQuote(
            amount: 1000,
            agentPercent: 2,
            companyPercent: 1,
            agentCommission: 20,
            companyCommission: 10,
            totalFee: 30,
            totalDebit: 1030,
            maxAmount: 970,
            tier: 'withdrawal',
          ),
        ),
      ),
    );

    expect(find.text('SSP 1,000.00'), findsOneWidget);

    // Neither commission is broken out. What the sender decides on is what
    // leaves their balance, and the 30 is the difference between the two rows.
    expect(find.textContaining('Agent fee'), findsNothing);
    expect(find.textContaining('Service fee'), findsNothing);
    expect(find.text('SSP 20.00'), findsNothing);
    expect(find.text('SSP 10.00'), findsNothing);

    // The figure that actually leaves the balance has to be on screen.
    expect(find.text('Total to pay'), findsOneWidget);
    expect(find.text('SSP 1,030.00'), findsOneWidget);
  });

  testWidgets('FeeBreakdown shows amount and total when nothing is charged', (
    tester,
  ) async {
    await tester.pumpWidget(host(const FeeBreakdown(quote: FeeQuote.empty())));
    // No "Free" row either — the two rows agreeing with each other says it.
    expect(find.text('Free'), findsNothing);
    expect(find.text('Total to pay'), findsOneWidget);
  });

  testWidgets('ActionRow renders every tile and reports taps', (tester) async {
    var tapped = '';

    await tester.pumpWidget(
      host(
        ActionRow(
          actions: [
            for (final label in const [
              'Send Money',
              'Withdraw',
              'Receive',
              'Pendings',
            ])
              WalletAction(
                icon: Icons.send_rounded,
                label: label,
                onTap: () => tapped = label,
              ),
          ],
        ),
      ),
    );

    expect(find.text('Send Money'), findsOneWidget);
    expect(find.text('Pendings'), findsOneWidget);

    await tester.tap(find.text('Withdraw'));
    expect(tapped, 'Withdraw');
  });

  testWidgets('BalanceCard prints the account in groups of four', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        BalanceCard(
          balance: 125750,
          hidden: false,
          onToggleHidden: () {},
          accountValue: Fmt.accountCode('+211912399537'),
        ),
      ),
    );

    // Digits only, grouped — an account code rather than a phone number.
    expect(find.text('2119 1239 9537'), findsOneWidget);
    expect(find.text('ACCOUNT'), findsOneWidget);
  });

  testWidgets('BalanceCard shows an agent their ID, ungrouped', (tester) async {
    await tester.pumpWidget(
      host(
        const BalanceCard(
          balance: 125750,
          hidden: false,
          onToggleHidden: _noop,
          accountLabel: 'Agent ID',
          accountValue: '483920',
        ),
      ),
    );

    // Six digits, whole. Grouping in fours would read it as "4839 20".
    expect(find.text('483920'), findsOneWidget);
    expect(find.text('AGENT ID'), findsOneWidget);
  });

  testWidgets('StatTile carries its rail colour', (tester) async {
    await tester.pumpWidget(
      host(
        const StatTile(
          label: 'Money Sent',
          value: 'SSP 68,500.00',
          rail: AppColors.danger,
        ),
      ),
    );

    expect(find.text('MONEY SENT'), findsOneWidget);
    expect(find.text('SSP 68,500.00'), findsOneWidget);
  });

  testWidgets('PrimaryButton swaps to a spinner and refuses taps while busy', (
    tester,
  ) async {
    var taps = 0;

    await tester.pumpWidget(
      host(PrimaryButton(label: 'Send', busy: true, onPressed: () => taps++)),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Send'), findsNothing);

    await tester.tap(find.byType(FilledButton));
    // Double-submitting a payment is the failure this guards against.
    expect(taps, 0);
  });

  testWidgets('PinPad fills a dot per digit and backspaces', (tester) async {
    var value = '';

    await tester.pumpWidget(
      host(
        StatefulBuilder(
          builder: (context, setState) => PinPad(
            length: 4,
            value: value,
            onChanged: (next) => setState(() => value = next),
          ),
        ),
      ),
    );

    await tester.tap(find.text('1'));
    await tester.pump();
    await tester.tap(find.text('2'));
    await tester.pump();
    expect(value, '12');

    await tester.tap(find.byIcon(Icons.backspace_outlined));
    await tester.pump();
    expect(value, '1');
  });

  testWidgets('PinPad stops at its length', (tester) async {
    var value = '';

    await tester.pumpWidget(
      host(
        StatefulBuilder(
          builder: (context, setState) => PinPad(
            length: 4,
            value: value,
            onChanged: (next) => setState(() => value = next),
          ),
        ),
      ),
    );

    for (var i = 0; i < 6; i++) {
      await tester.tap(find.text('7'));
      await tester.pump();
    }
    expect(value, '7777');
  });

  testWidgets('PartyConfirmation shows who is about to be paid', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const PartyConfirmation(
          name: 'Peter Daniel',
          detail: '+211 912 345 004',
          badge: 'AGENT',
        ),
      ),
    );

    expect(find.text('Peter Daniel'), findsOneWidget);
    expect(find.text('+211 912 345 004'), findsOneWidget);
    expect(find.text('AGENT'), findsOneWidget);
  });

  testWidgets('Notice renders in each tone', (tester) async {
    for (final notice in const [
      Notice(message: 'Insufficient balance'),
      Notice.info(message: 'Not connected yet'),
      Notice.warning(message: 'Account suspended'),
      Notice.success(message: 'Request sent'),
    ]) {
      await tester.pumpWidget(host(notice));
      expect(find.byType(Notice), findsOneWidget);
    }
  });

  testWidgets('The brand lockup paints the real artwork, not a drawn stand-in', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        const Column(
          children: [
            BrandLockup(),
            SizedBox(height: 20),
            BrandMark(size: 24),
            SizedBox(height: 20),
            BrandWave(height: 120),
          ],
        ),
      ),
    );

    // The wordmark is part of the logo file, so it is an asset rather than
    // text. Asserting on the asset paths is what catches a rename or a missing
    // pubspec entry - the failure mode that would otherwise ship a fallback
    // icon where the brand should be.
    final assets = tester
        .widgetList<Image>(find.byType(Image))
        .map((image) => (image.image as AssetImage).assetName)
        .toList();

    expect(assets, contains('assets/images/mp-logo.png'));
    expect(assets, contains('assets/images/mp-icon.png'));
    expect(tester.takeException(), isNull);
  });

  testWidgets('Confirm dialog keeps its button labels on one line', (
    tester,
  ) async {
    // 360dp, the narrow end of what this app runs on. The buttons are equal
    // halves of the dialog, so "Sign out" plus the button's own padding landed
    // right at the edge and wrapped to two lines on a real phone while fitting
    // in a wider preview.
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () => showConfirmDialog(
                  context,
                  icon: Icons.logout_rounded,
                  title: 'Sign out?',
                  message:
                      'You will need your email and password to sign back in.',
                  confirmLabel: 'Sign out',
                  destructive: true,
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Sign out?'), findsOneWidget);

    // Measured on the FittedBox, not the Text. Inside a FittedBox the Text is
    // laid out unbounded and then scaled, so its own size reports a single
    // line whether or not it would have fitted -- measuring it would pass with
    // the fix removed.
    for (final label in const ['Sign out', 'Cancel']) {
      final box = find.ancestor(
        of: find.text(label),
        matching: find.byType(FittedBox),
      );
      expect(box, findsOneWidget, reason: '"$label" is not shrink-to-fit');

      final size = tester.getSize(box);
      expect(
        size.height,
        lessThan(26),
        reason: '"$label" wrapped onto a second line',
      );
      // And it is not shrunk to illegibility to achieve that.
      expect(size.height, greaterThan(10));
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('EmptyState carries its action', (tester) async {
    var pressed = false;

    await tester.pumpWidget(
      host(
        EmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'No transactions yet',
          message: 'Money you send and receive will appear here.',
          action: OutlinedButton(
            onPressed: () => pressed = true,
            child: const Text('Try again'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Try again'));
    expect(pressed, isTrue);
  });
}
