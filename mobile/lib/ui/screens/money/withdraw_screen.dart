import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

/// Take cash out through an agent.
///
/// The agent is identified by the six-digit ID on their badge rather than
/// picked from a list — there is no agent directory endpoint, and the code is
/// how the two people at the counter confirm they mean each other anyway. The
/// name that comes back is the check: it should match the person in front of
/// you before any amount is typed.
class WithdrawScreen extends StatefulWidget {
  const WithdrawScreen({super.key});

  @override
  State<WithdrawScreen> createState() => _WithdrawScreenState();
}

class _WithdrawScreenState extends State<WithdrawScreen> {
  final _formKey = GlobalKey<FormState>();

  /// Where focus goes when a form is submitted. See [KeyboardSink]: without it
  /// the confirmation sheet popping hands focus back to the last text field and
  /// the keyboard reappears over the transition.
  final _keyboardSink = FocusNode(debugLabel: 'keyboard sink');
  final _agentId = TextEditingController();
  final _amount = TextEditingController();

  Timer? _quoteDebounce;

  AgentInfo? _agent;
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
  void dispose() {
    _quoteDebounce?.cancel();
    _agentId.dispose();
    _amount.dispose();
    _keyboardSink.dispose();
    super.dispose();
  }

  double get _amountValue => Fmt.parseAmount(_amount.text);

  void _onAgentIdChanged(String value) {
    setState(() {
      _agent = null;
      _lookupError = null;
    });
    if (value.trim().length == 6) _lookupAgent();
  }

  Future<void> _lookupAgent() async {
    setState(() {
      _lookingUp = true;
      _lookupError = null;
    });

    try {
      final agent = await context.read<WalletController>().lookupAgent(
        _agentId.text.trim(),
      );
      if (!mounted) return;

      if (agent.isSuspended) {
        setState(
          () => _lookupError =
              'That agent is suspended and cannot pay out cash right now.',
        );
        return;
      }
      setState(() => _agent = agent);
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
    if (_amountValue <= 0) return;
    setState(() => _quoting = true);
    try {
      final quote = await context.read<WalletController>().quoteWithdrawal(
        _amountValue,
      );
      if (mounted) setState(() => _quote = quote);
    } on ApiException {
      /* The server prices it again on submit. */
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

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
      final quote = await context.read<WalletController>().quoteWithdrawal(
        _amountValue,
      );
      if (!mounted) return false;
      setState(() => _quote = quote);

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

    final agent = _agent;
    if (agent == null) {
      setState(() => _error = 'Enter the agent ID and confirm their name.');
      return;
    }

    _keyboardSink.requestFocus();

    if (!await _priceBeforeConfirming()) return;
    if (!mounted) return;

    final confirmed = await showConfirmSheet(
      context,
      title: 'Confirm withdrawal',
      partyName: agent.name,
      partyDetail: 'Agent ${agent.agentId} · ${Phone.pretty(agent.phone)}',
      amount: _amountValue,
      totalDebit: _quote.totalDebit,
      actionLabel: 'Withdraw ${Fmt.money(_amountValue)}',
      caution:
          'Only confirm once the agent has the cash ready to hand to you. '
          'The transfer completes immediately.',
    );
    if (confirmed != true || !mounted) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final reference = await context.read<WalletController>().withdraw(
        agentId: agent.agentId,
        amount: _amountValue,
      );
      if (!mounted) return;

      Navigator.of(context).pushReplacementNamed(
        Routes.transferReceipt,
        arguments: ReceiptDetails(
          title: 'Withdrawal complete',
          reference: reference,
          amount: _amountValue,
          total: _quote.totalDebit,
          partyLabel: 'Agent',
          partyName: agent.name,
          partyDetail: 'ID ${agent.agentId}',
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
        title: const Text('Withdraw Cash'),
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
              BalanceCard(
                balance: balance,
                hidden: _balanceHidden,
                onToggleHidden: () =>
                    setState(() => _balanceHidden = !_balanceHidden),
                label: 'Available to withdraw',
              ),
              const SizedBox(height: 8),
              const Text(
                'Fees are taken on top of the amount you withdraw.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
              const SizedBox(height: 18),

              if (user?.isSuspended ?? false) ...[
                const Notice.warning(
                  message:
                      'Your account is suspended, so withdrawals are paused.',
                ),
                const SizedBox(height: 18),
              ],

              LabelledField(
                // Keyed for the same reason as the send form: the confirmation
                // and error blocks between this field and the amount appear as
                // an agent is looked up, and unkeyed children are matched by
                // position — so the amount field lost its element, and its
                // focus, every time one of them arrived.
                key: const ValueKey('field-agent-id'),
                label: 'Agent ID',
                child: TextFormField(
                  controller: _agentId,
                  keyboardType: TextInputType.number,
                  onChanged: _onAgentIdChanged,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(6),
                  ],
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 3,
                  ),
                  decoration: InputDecoration(
                    hintText: '000000',
                    hintStyle: const TextStyle(
                      fontSize: 17,
                      letterSpacing: 3,
                      color: AppColors.textMuted,
                    ),
                    prefixIcon: const Icon(Icons.badge_outlined, size: 19),
                    suffixIcon: _lookingUp
                        ? const Padding(
                            padding: EdgeInsets.all(14),
                            child: SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : null,
                  ),
                  validator: (value) => (value ?? '').trim().length == 6
                      ? null
                      : 'An agent ID is six digits',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Ask the agent for the six-digit ID on their badge.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),

              if (_lookupError != null) ...[
                const SizedBox(height: 12),
                Notice(message: _lookupError!),
              ],

              if (_agent != null) ...[
                const SizedBox(height: 12),
                PartyConfirmation(
                  name: _agent!.name,
                  detail:
                      'Agent ${_agent!.agentId} · '
                      '${Phone.pretty(_agent!.phone)}',
                  badge: 'AGENT',
                  onClear: () {
                    _agentId.clear();
                    setState(() => _agent = null);
                  },
                ),
              ],

              const SizedBox(height: 22),

              LabelledField(
                key: const ValueKey('field-amount'),
                label: 'Amount to withdraw',
                trailingLabel: _quote.maxAmount > 0
                    ? GestureDetector(
                        onTap: () {
                          _amount.text = _quote.maxAmount.toStringAsFixed(2);
                          _requestQuote();
                        },
                        child: Text(
                          // Dropped while hidden: the maximum is the balance
                          // less fees, so it would give the figure away.
                          _balanceHidden
                              ? 'Max'
                              : 'Max ${Fmt.money(_quote.maxAmount)}',
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
                    final amount = Fmt.parseAmount(value);
                    if (amount <= 0) return 'Enter an amount to withdraw';
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
                FeeBreakdown(
                  quote: _quote,
                  loading: _quoting,
                  amountLabel: 'Cash you receive',
                ),
              ],

              if (_error != null) ...[
                const SizedBox(height: 16),
                Notice(message: _error!),
              ],

              const SizedBox(height: 26),
              PrimaryButton(
                label: 'Confirm',
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
