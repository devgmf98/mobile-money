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
import '../../../state/auth_controller.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/wallet_widgets.dart';

/// Agent side: pay a customer cash and take it from their wallet.
///
/// The agent cannot simply take the money — the request is created pending and
/// the customer approves it on their own phone. That is the whole safeguard, so
/// the screen says so plainly rather than implying the cash-out is done.
class AgentCashOutScreen extends StatefulWidget {
  const AgentCashOutScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<AgentCashOutScreen> createState() => _AgentCashOutScreenState();
}

class _AgentCashOutScreenState extends State<AgentCashOutScreen> {
  final _formKey = GlobalKey<FormState>();

  /// Where focus goes when a form is submitted. See [KeyboardSink]: without it
  /// the confirmation sheet popping hands focus back to the last text field and
  /// the keyboard reappears over the transition.
  final _keyboardSink = FocusNode(debugLabel: 'keyboard sink');
  final _phone = TextEditingController();
  final _amount = TextEditingController();

  Timer? _lookupDebounce;
  Timer? _quoteDebounce;

  PartyInfo? _customer;
  bool _lookingUp = false;
  String? _lookupError;

  FeeQuote _quote = const FeeQuote.empty();
  bool _quoting = false;

  bool _submitting = false;
  bool _sent = false;
  String? _error;

  @override
  void dispose() {
    _lookupDebounce?.cancel();
    _quoteDebounce?.cancel();
    _phone.dispose();
    _amount.dispose();
    _keyboardSink.dispose();
    super.dispose();
  }

  double get _amountValue => double.tryParse(_amount.text.trim()) ?? 0;

  void _onPhoneChanged(String _) {
    setState(() {
      _customer = null;
      _lookupError = null;
      _sent = false;
    });
    _lookupDebounce?.cancel();
    if (!Phone.looksValid(_phone.text)) return;
    _lookupDebounce = Timer(const Duration(milliseconds: 600), _lookup);
  }

  Future<void> _lookup() async {
    setState(() {
      _lookingUp = true;
      _lookupError = null;
    });

    try {
      final party = await context.read<WalletController>().lookupRecipient(
        Phone.normalise(_phone.text),
      );
      if (!mounted) return;

      if (party.isAgent) {
        setState(
          () => _lookupError =
              'That number belongs to another agent. Agents settle through '
              'the company, not with each other.',
        );
        return;
      }
      setState(() => _customer = party);
    } on ApiException catch (error) {
      if (mounted) setState(() => _lookupError = error.message);
    } finally {
      if (mounted) setState(() => _lookingUp = false);
    }
  }

  void _onAmountChanged(String _) {
    _quoteDebounce?.cancel();
    setState(() => _sent = false);
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
      /* Priced again on submit. */
    } finally {
      if (mounted) setState(() => _quoting = false);
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final customer = _customer;
    if (customer == null) {
      setState(() => _error = 'Confirm the customer before requesting.');
      return;
    }

    /* What approving actually takes out of the customer's wallet: the cash
       plus both commissions. Priced by the server, so this is the same figure
       it will check. */
    final cost = _quote.totalDebit > 0 ? _quote.totalDebit : _amountValue;

    /* Requests the customer has not answered yet are already claims on the
       same balance, so they come off what is still available. Without this an
       agent could raise a second request that fit on its own, and the customer
       would be left holding two they could only approve one of. The server
       refuses it too -- it is the only side that can be certain, since another
       agent may have asked since this lookup -- but catching it here means the
       customer is never asked in the first place. */
    if (cost > customer.availableBalance) {
      final free = Fmt.money(customer.availableBalance);
      setState(
        () => _error = customer.pendingDebit > 0
            ? "Total amount requested is greater than the user's balance. "
                  '${Fmt.money(customer.pendingDebit)} is already awaiting their '
                  'approval, so only $free is still free.'
            : "Total amount requested is greater than the user's balance of "
                  '${Fmt.money(customer.balance)}.',
      );
      AppSnack.error(context, _error!);
      return;
    }

    _keyboardSink.requestFocus();
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await context.read<WalletController>().requestWithdrawalFromCustomer(
        userPhone: customer.phone,
        amount: _amountValue,
      );
      if (!mounted) return;
      setState(() => _sent = true);
      AppSnack.success(context, 'Request sent to ${customer.name}.');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;
    final wallet = context.watch<WalletController>();

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        leading: widget.embedded ? null : const BackButton(),
        title: const Text('Pull Funds'),
      ),
      body: SafeArea(
        bottom: false,
        child: Form(
          key: _formKey,
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              AppSizes.gutter,
              8,
              AppSizes.gutter,
              32,
            ),
            children: [
              KeyboardSink(node: _keyboardSink),
              if (user?.agentId != null)
                _AgentBadge(
                  agentId: user!.agentId!,
                  earned: wallet.stats.commissionEarned,
                ),
              const SizedBox(height: 20),

              const Notice.info(
                message:
                    'The customer approves this on their own phone. Hand over '
                    'the cash only once you see it approved.',
              ),
              const SizedBox(height: 20),

              LabelledField(
                // See the send form — conditional blocks sit between this and
                // the amount, and unkeyed children shift with them.
                key: const ValueKey('field-customer'),
                label: 'Customer phone number',
                child: PhoneField(
                  controller: _phone,
                  onChanged: _onPhoneChanged,
                  trailing: _lookingUp
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : null,
                  validator: (value) => Phone.looksValid(value ?? '')
                      ? null
                      : 'Enter the customer phone number',
                ),
              ),

              if (_lookupError != null) ...[
                const SizedBox(height: 12),
                Notice(message: _lookupError!),
              ],

              if (_customer != null) ...[
                const SizedBox(height: 12),
                PartyConfirmation(
                  name: _customer!.name,
                  detail: Phone.pretty(_customer!.phone),
                  onClear: () {
                    _phone.clear();
                    setState(() => _customer = null);
                  },
                ),
              ],

              const SizedBox(height: 22),
              LabelledField(
                key: const ValueKey('field-amount'),
                label: 'Cash to hand over',
                child: AmountField(
                  controller: _amount,
                  onChanged: _onAmountChanged,
                  validator: (value) {
                    final amount = double.tryParse((value ?? '').trim()) ?? 0;
                    return amount <= 0 ? 'Enter the amount of cash' : null;
                  },
                ),
              ),

              if (_amountValue > 0) ...[
                const SizedBox(height: 14),
                FeeBreakdown(
                  quote: _quote,
                  loading: _quoting,
                  amountLabel: 'Cash handed over',
                ),
                const SizedBox(height: 10),
                Text(
                  'You earn ${Fmt.money(_quote.agentCommission)} on this '
                  'cash-out. The customer is charged '
                  '${Fmt.money(_quote.totalDebit)} in total.',
                  style: const TextStyle(
                    fontSize: 12.5,
                    height: 1.45,
                    color: AppColors.textMuted,
                  ),
                ),
              ],

              if (_error != null) ...[
                const SizedBox(height: 16),
                Notice(message: _error!),
              ],

              if (_sent) ...[
                const SizedBox(height: 16),
                const Notice.success(
                  message:
                      'Request sent. It stays pending until the customer '
                      'approves it on their phone.',
                ),
              ],

              const SizedBox(height: 24),
              PrimaryButton(
                label: 'Request Approval',
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

/// The agent's identity, which is what this screen actually needs.
///
/// It used to lead with the agent's own balance, which was wrong three times
/// over. Pulling funds moves money *into* this wallet, so the float is not the
/// limit -- the customer's balance is, and the server checks it. Showing it
/// implied a ceiling that does not exist, so an agent with a thin float might
/// turn away business they could have taken. And it printed the figure in full
/// on the one screen guaranteed to be used with a customer standing at the
/// counter looking at it, while every other screen now hides it by default.
///
/// What belongs here is the ID the customer verifies, so that leads instead.
class _AgentBadge extends StatelessWidget {
  const _AgentBadge({required this.agentId, required this.earned});

  final String agentId;
  final double earned;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: AppColors.headerGradient,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.badge_outlined, size: 17, color: Colors.white70),
              const SizedBox(width: 7),
              const Text(
                'Pull funds from a customer',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: Colors.white70,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            agentId,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.5,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'Your agent ID · ${Fmt.money(earned)} earned so far',
            style: const TextStyle(fontSize: 12.5, color: Colors.white70),
          ),
        ],
      ),
    );
  }
}
