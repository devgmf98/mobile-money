import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../data/models/fee_quote.dart';
import '../../../data/models/lookup.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/wallet_widgets.dart';
import 'confirm_sheet.dart';
import 'receipt_screen.dart';

/// Send money to another MoneyPay account.
///
/// The screen does three things before it will let a payment through: confirms
/// who the number belongs to, prices the transfer on the server, and shows the
/// total that will actually leave the balance. Sending to an agent is a
/// cash-out and is priced on the withdrawal tier — the server decides that, and
/// the fee breakdown says so.
class SendMoneyScreen extends StatefulWidget {
  const SendMoneyScreen({super.key, this.initialPhone});

  /// Pre-filled when arriving from a scanned QR code.
  final String? initialPhone;

  @override
  State<SendMoneyScreen> createState() => _SendMoneyScreenState();
}

class _SendMoneyScreenState extends State<SendMoneyScreen> {
  final _formKey = GlobalKey<FormState>();

  /// Where focus goes when a form is submitted. See [KeyboardSink]: without it
  /// the confirmation sheet popping hands focus back to the last text field and
  /// the keyboard reappears over the transition.
  final _keyboardSink = FocusNode(debugLabel: 'keyboard sink');

  /// The recipient field's focus, held here so it is requested exactly once.
  final _phoneFocus = FocusNode(debugLabel: 'recipient');
  final _phone = TextEditingController();
  final _amount = TextEditingController();
  final _description = TextEditingController();

  Timer? _lookupDebounce;
  Timer? _quoteDebounce;

  PartyInfo? _recipient;
  bool _lookingUp = false;
  String? _lookupError;

  FeeQuote _quote = const FeeQuote.empty();
  bool _quoting = false;

  bool _submitting = false;

  /// Hidden until asked for, as on the dashboard. This screen is used standing
  /// at a counter with someone beside you, which is exactly when a balance
  /// should not be the largest thing on the page.
  bool _balanceHidden = true;

  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.initialPhone != null) {
      _phone.text = Phone.pretty(widget.initialPhone);
      WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
    } else {
      // Once, on arrival. Not `autofocus`, which re-runs whenever this field's
      // element is rebuilt — and confirming a recipient rebuilds this list, so
      // a lookup finishing would snatch the cursor back out of the amount
      // field the moment it landed.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _phoneFocus.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _lookupDebounce?.cancel();
    _quoteDebounce?.cancel();
    _phone.dispose();
    _amount.dispose();
    _description.dispose();
    _keyboardSink.dispose();
    _phoneFocus.dispose();
    super.dispose();
  }

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;

  // ------------------------------------------------------------- lookups

  void _onPhoneChanged(String _) {
    setState(() {
      _recipient = null;
      _lookupError = null;
      // A failure from the last attempt should not still be on screen once the
      // recipient has been changed — it is about a payment that no longer
      // describes what the form says.
      _error = null;
      _quote = const FeeQuote.empty();
    });
    _lookupDebounce?.cancel();
    if (!Phone.looksValid(_phone.text)) return;
    _lookupDebounce = Timer(const Duration(milliseconds: 600), _lookup);
  }

  Future<void> _lookup() async {
    final phone = Phone.normalise(_phone.text);
    if (!Phone.looksValid(phone)) return;

    final me = context.read<AuthController>().user;
    if (me != null && Phone.sameNumber(me.phone, phone)) {
      setState(() => _lookupError = 'You cannot send money to yourself.');
      return;
    }

    setState(() {
      _lookingUp = true;
      _lookupError = null;
    });

    try {
      final party = await context.read<WalletController>().lookupRecipient(
        phone,
      );
      if (!mounted) return;
      setState(() => _recipient = party);
      // The tier depends on who is being paid, so the quote is only meaningful
      // once the recipient is known.
      _requestQuote();
    } on ApiException catch (error) {
      if (mounted) setState(() => _lookupError = error.message);
    } finally {
      if (mounted) setState(() => _lookingUp = false);
    }
  }

  void _onAmountChanged(String _) {
    _quoteDebounce?.cancel();
    if (_amountValue <= 0) {
      setState(() => _quote = const FeeQuote.empty());
      return;
    }
    _quoteDebounce = Timer(const Duration(milliseconds: 450), _requestQuote);
  }

  Future<void> _requestQuote() async {
    final amount = _amountValue;
    if (amount <= 0) return;

    setState(() => _quoting = true);
    try {
      final quote = await context.read<WalletController>().quoteSend(
        amount: amount,
        recipientPhone: _recipient?.phone,
      );
      if (mounted) setState(() => _quote = quote);
    } on ApiException {
      // A failed quote must not block the form — the server prices the transfer
      // again when it is submitted, and refuses it there if it cannot be paid.
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  // -------------------------------------------------------------- submit

  /// Re-prices the transfer and waits for the answer, for the moment just
  /// before the confirmation sheet opens.
  ///
  /// The quote the form shows is debounced, so someone who types an amount and
  /// taps straight through arrives here with the *previous* quote - or the
  /// empty one. The sheet would then state a total of SSP 0.00 over an amount
  /// the server is about to charge fees on. Refusing to open the sheet until
  /// the figure is real is the only honest option: this is the screen whose
  /// entire job is to say what the payment will cost.
  Future<bool> _priceBeforeConfirming() async {
    _quoteDebounce?.cancel();

    setState(() {
      _quoting = true;
      _error = null;
    });

    try {
      final quote = await context.read<WalletController>().quoteSend(
        amount: _amountValue,
        recipientPhone: _recipient?.phone,
      );
      if (!mounted) return false;
      setState(() => _quote = quote);

      // Re-check affordability against the figure that was just priced, not
      // the one the form happened to be holding.
      final balance = context.read<AuthController>().user?.balance ?? 0;
      if (quote.totalDebit > balance) {
        setState(
          () => _error =
              'That is more than your balance can cover once fees are added.',
        );
        return false;
      }
      return true;
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
      return false;
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final recipient = _recipient;
    if (recipient == null) {
      setState(() => _error = 'Confirm the recipient before sending.');
      return;
    }
    if (!_quote.allowed) {
      setState(() => _error = 'You cannot send money to this account.');
      return;
    }

    _keyboardSink.requestFocus();

    if (!await _priceBeforeConfirming()) return;
    if (!mounted) return;

    final confirmed = await showConfirmSheet(
      context,
      title: _quote.isCashOut ? 'Confirm withdrawal' : 'Confirm transfer',
      partyName: recipient.name,
      partyDetail: Phone.pretty(recipient.phone),
      amount: _amountValue,
      totalDebit: _quote.totalDebit,
      note: _description.text.trim().isEmpty ? null : _description.text.trim(),
      actionLabel: 'Send ${Fmt.money(_amountValue)}',
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final reference = await context.read<WalletController>().sendMoney(
        recipientPhone: recipient.phone,
        amount: _amountValue,
        description: _description.text,
      );
      if (!mounted) return;

      Navigator.of(context).pushReplacementNamed(
        Routes.transferReceipt,
        arguments: ReceiptDetails(
          title: _quote.isCashOut ? 'Withdrawal sent' : 'Money sent',
          reference: reference,
          amount: _amountValue,
          total: _quote.totalDebit,
          partyLabel: 'To',
          partyName: recipient.name,
          partyDetail: Phone.pretty(recipient.phone),
          note: _description.text.trim().isEmpty
              ? null
              : _description.text.trim(),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final balance = user?.balance ?? 0;

    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Send Money'),
      ),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.gutter,
              8,
              AppSizes.gutter,
              32,
            ),
            children: [
              KeyboardSink(node: _keyboardSink),
              _BalanceStrip(
                balance: balance,
                hidden: _balanceHidden,
                onToggle: () =>
                    setState(() => _balanceHidden = !_balanceHidden),
              ),
              const SizedBox(height: 22),

              if (user?.isSuspended ?? false) ...[
                const Notice.warning(
                  message:
                      'Your account is suspended, so you cannot send money '
                      'right now.',
                ),
                const SizedBox(height: 18),
              ],

              LabelledField(
                // Keyed, all three of them. The blocks between this field and
                // the amount appear and disappear as a recipient is confirmed,
                // and unkeyed children are matched by position — so inserting
                // two widgets here handed the amount field's element to a
                // different widget, rebuilding it and dropping its focus.
                key: const ValueKey('field-recipient'),
                label: 'Send to',
                child: PhoneField(
                  controller: _phone,
                  focusNode: _phoneFocus,
                  onChanged: _onPhoneChanged,
                  trailing: _lookingUp
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          onPressed: () =>
                              Navigator.of(context).pushNamed(Routes.scanQr),
                          icon: const Icon(
                            Icons.qr_code_scanner_rounded,
                            size: 19,
                          ),
                          color: AppColors.primary,
                          tooltip: 'Scan a QR code',
                        ),
                  validator: (value) => Phone.looksValid(value ?? '')
                      ? null
                      : 'Enter the recipient phone number',
                ),
              ),

              if (_lookupError != null) ...[
                const SizedBox(height: 12),
                Notice(message: _lookupError!),
              ],

              if (_recipient != null) ...[
                const SizedBox(height: 12),
                PartyConfirmation(
                  name: _recipient!.name,
                  detail: Phone.pretty(_recipient!.phone),
                  badge: _recipient!.isAgent ? 'AGENT' : null,
                  onClear: () {
                    _phone.clear();
                    setState(() {
                      _recipient = null;
                      _quote = const FeeQuote.empty();
                    });
                  },
                ),
              ],

              if (_recipient?.isAgent ?? false) ...[
                const SizedBox(height: 12),
                const Notice.info(
                  message:
                      'This number belongs to an agent, so this counts as a '
                      'cash withdrawal and is charged at the withdrawal rate.',
                ),
              ],

              if (_recipient != null && !_quote.allowed) ...[
                const SizedBox(height: 12),
                const Notice(
                  message:
                      'You cannot send money to this account. Agents settle '
                      'through the company rather than with each other.',
                ),
              ],

              const SizedBox(height: 20),

              LabelledField(
                key: const ValueKey('field-amount'),
                label: 'Amount',
                trailingLabel: _quote.maxAmount > 0
                    ? GestureDetector(
                        onTap: () {
                          _amount.text = _quote.maxAmount.toStringAsFixed(2);
                          _requestQuote();
                        },
                        child: Text(
                          // The figure is dropped while the balance is
                          // hidden -- the sendable maximum is the balance less
                          // fees, so printing it here would undo the masking.
                          _balanceHidden
                              ? 'Send all'
                              : 'Send all (${Fmt.money(_quote.maxAmount)})',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: AppColors.primary,
                          ),
                        ),
                      )
                    : null,
                child: AmountField(
                  controller: _amount,
                  onChanged: _onAmountChanged,
                  validator: (value) {
                    final amount = double.tryParse((value ?? '').trim()) ?? 0;
                    if (amount <= 0) return 'Enter an amount to send';
                    if (_quote.totalDebit > balance) {
                      return 'That is more than your balance can cover '
                          'once fees are added';
                    }
                    return null;
                  },
                ),
              ),

              if (_amountValue > 0) ...[
                const SizedBox(height: 14),
                FeeBreakdown(quote: _quote, loading: _quoting),
                // Paying an agent is a cash-out, and the server prices it from
                // the withdrawal tiers rather than the send-money ones. Without
                // saying so, a charge on a transfer looks like a fee appearing
                // from nowhere when the send-money tiers are empty. The web
                // send form has carried this line all along.
                if (_quote.isCashOut && _quote.hasFee) ...[
                  const SizedBox(height: 8),
                  const Text(
                    'Paying an agent is a withdrawal, so it is charged at '
                    'withdrawal rates rather than transfer rates.',
                    style: TextStyle(
                      fontSize: 11.5,
                      height: 1.4,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ],

              const SizedBox(height: 20),

              LabelledField(
                key: const ValueKey('field-description'),
                label: 'Description (Optional)',
                child: TextFormField(
                  controller: _description,
                  maxLength: 120,
                  textInputAction: TextInputAction.done,
                  decoration: const InputDecoration(
                    hintText: 'Add a note',
                    counterText: '',
                  ),
                ),
              ),

              if (_error != null) ...[
                const SizedBox(height: 4),
                Notice(message: _error!),
              ],

              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Continue',
                busy: _submitting,
                onPressed: (user?.isSuspended ?? false) ? null : _submit,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The balance shown above the form — the figure the amount has to fit inside.
class _BalanceStrip extends StatelessWidget {
  const _BalanceStrip({
    required this.balance,
    required this.hidden,
    required this.onToggle,
  });

  final double balance;
  final bool hidden;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.canvas,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Available Balance',
                  style: TextStyle(
                    fontSize: 12.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  hidden ? '••••••' : Fmt.money(balance),
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.4,
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            onPressed: onToggle,
            icon: Icon(
              hidden
                  ? Icons.visibility_outlined
                  : Icons.visibility_off_outlined,
              size: 20,
              color: AppColors.textSecondary,
            ),
            tooltip: hidden ? 'Show balance' : 'Hide balance',
          ),
        ],
      ),
    );
  }
}
