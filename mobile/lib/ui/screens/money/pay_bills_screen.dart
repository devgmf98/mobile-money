import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/services_api.dart';
import '../../widgets/controls.dart';

/// Pay a bill.
///
/// Same footing as airtime: the API has no biller routes, so the screen is
/// built to the design and the request goes through [ServicesApi], which says
/// plainly that it is not connected. Nothing here invents a payment.
class PayBillsScreen extends StatefulWidget {
  const PayBillsScreen({super.key});

  @override
  State<PayBillsScreen> createState() => _PayBillsScreenState();
}

class _PayBillsScreenState extends State<PayBillsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _account = TextEditingController();
  final _amount = TextEditingController();

  BillerCategory? _biller;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _account.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await context.read<ServicesApi>().payBill(
        biller: _biller!.id,
        account: _account.text.trim(),
        amount: double.tryParse(_amount.text.trim()) ?? 0,
      );
      if (mounted) AppSnack.success(context, 'Bill paid.');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: _biller == null
            ? const BackButton()
            : IconButton(
                onPressed: () => setState(() => _biller = null),
                icon: const Icon(Icons.arrow_back_rounded),
              ),
        title: Text(_biller?.name ?? 'Pay Bills'),
      ),
      body: SafeArea(child: _biller == null ? _pickBiller() : _payForm()),
    );
  }

  Widget _pickBiller() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSizes.gutter,
        12,
        AppSizes.gutter,
        32,
      ),
      children: [
        const Notice.info(
          message:
              'Bill payments are not connected yet. You can see how the '
              'screen works, but no payment will go through.',
        ),
        const SizedBox(height: 22),
        const Text(
          'Select Biller',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w500,
            color: AppColors.textSecondary,
          ),
        ),
        const SizedBox(height: 10),
        for (final biller in BillerCategory.all)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _BillerRow(
              biller: biller,
              onTap: () => setState(() => _biller = biller),
            ),
          ),
      ],
    );
  }

  Widget _payForm() {
    final biller = _biller!;

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          12,
          AppSizes.gutter,
          32,
        ),
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: biller.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(biller.icon, size: 22, color: biller.color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      biller.name,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Enter the account and amount to pay',
                      style: TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          LabelledField(
            label: 'Account or Meter Number',
            child: TextFormField(
              controller: _account,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                hintText: 'e.g. 0123456789',
                prefixIcon: Icon(Icons.tag_rounded, size: 19),
              ),
              validator: (value) => (value ?? '').trim().length < 3
                  ? 'Enter the account number on your bill'
                  : null,
            ),
          ),
          const SizedBox(height: 22),

          LabelledField(
            label: 'Amount',
            child: AmountField(
              controller: _amount,
              validator: (value) {
                final amount = double.tryParse((value ?? '').trim()) ?? 0;
                return amount <= 0 ? 'Enter an amount to pay' : null;
              },
            ),
          ),

          if (_error != null) ...[
            const SizedBox(height: 18),
            Notice(message: _error!),
          ],

          const SizedBox(height: 26),
          PrimaryButton(label: 'Continue', busy: _busy, onPressed: _submit),
        ],
      ),
    );
  }
}

class _BillerRow extends StatelessWidget {
  const _BillerRow({required this.biller, required this.onTap});

  final BillerCategory biller;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSizes.radiusCard),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: biller.color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(biller.icon, size: 19, color: biller.color),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  biller.name,
                  style: const TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              const Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: AppColors.textMuted,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
