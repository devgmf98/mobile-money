import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/services_api.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/brand_app_bar.dart';

/// Buy airtime for a mobile number.
///
/// Built to the design, but there is no airtime endpoint on the API — no
/// route, no controller, no model. The form works and the request is made
/// properly through [ServicesApi]; it fails with a plain explanation rather
/// than pretending a top-up happened. The banner says so before anything is
/// typed, because finding out after filling in a form is worse.
class BuyAirtimeScreen extends StatefulWidget {
  const BuyAirtimeScreen({super.key});

  @override
  State<BuyAirtimeScreen> createState() => _BuyAirtimeScreenState();
}

class _BuyAirtimeScreenState extends State<BuyAirtimeScreen> {
  /// The quick-amount chips from the design.
  static const _presets = <double>[100, 200, 500];

  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _amount = TextEditingController();

  MobileNetwork _network = MobileNetwork.all.first;
  double? _preset = 100;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _amount.text = '100';
    // Own number by default — topping up your own line is the common case.
    final user = context.read<AuthController>().user;
    if (user != null) _phone.text = Phone.pretty(user.phone);
  }

  @override
  void dispose() {
    _phone.dispose();
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
      await context.read<ServicesApi>().buyAirtime(
        network: _network.id,
        phone: Phone.normalise(_phone.text),
        amount: Fmt.parseAmount(_amount.text),
      );
      if (mounted) AppSnack.success(context, 'Airtime sent.');
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const BrandAppBar(),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.gutter,
              12,
              AppSizes.gutter,
              32,
            ),
            children: [
              const Notice.info(
                message:
                    'Airtime top-ups are not connected yet. You can see how '
                    'the screen works, but no purchase will go through.',
              ),
              const SizedBox(height: 22),

              const Text(
                'Mobile Network',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  for (final network in MobileNetwork.all) ...[
                    Expanded(
                      child: _NetworkTile(
                        network: network,
                        selected: _network.id == network.id,
                        onTap: () => setState(() => _network = network),
                      ),
                    ),
                    if (network != MobileNetwork.all.last)
                      const SizedBox(width: 10),
                  ],
                ],
              ),
              const SizedBox(height: 22),

              LabelledField(
                label: 'Phone Number',
                child: PhoneField(
                  controller: _phone,
                  validator: (value) => Phone.looksValid(value ?? '')
                      ? null
                      : 'Enter the number to top up',
                ),
              ),
              const SizedBox(height: 22),

              const Text(
                'Amount',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 10),
              AmountChips(
                amounts: _presets,
                selected: _preset,
                onSelected: (amount) {
                  setState(() {
                    _preset = amount;
                    if (amount != null) {
                      _amount.text = amount.toStringAsFixed(0);
                    } else {
                      _amount.clear();
                    }
                  });
                },
              ),
              const SizedBox(height: 14),
              AmountField(
                controller: _amount,
                // Typing an amount that happens to match a chip re-selects it,
                // so the chips and the field never contradict each other.
                onChanged: (value) {
                  final amount = Fmt.parseAmount(value);
                  final preset = _presets.contains(amount) ? amount : null;
                  if (preset != _preset) setState(() => _preset = preset);
                },
                validator: (value) {
                  final amount = Fmt.parseAmount(value);
                  return amount <= 0 ? 'Enter an amount' : null;
                },
              ),

              if (_error != null) ...[
                const SizedBox(height: 18),
                Notice(message: _error!),
              ],

              const SizedBox(height: 26),
              PrimaryButton(label: 'Continue', busy: _busy, onPressed: _submit),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'You are buying ${Fmt.money(Fmt.parseAmount(_amount.text))} '
                  'of ${_network.name} airtime.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NetworkTile extends StatelessWidget {
  const _NetworkTile({
    required this.network,
    required this.selected,
    required this.onTap,
  });

  final MobileNetwork network;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.primaryTint : AppColors.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSizes.radiusCard),
            border: Border.all(
              color: selected ? AppColors.primary : AppColors.border,
              width: selected ? 1.4 : 1,
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: network.color.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                alignment: Alignment.center,
                child: Text(
                  network.name.substring(0, 1),
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: network.color,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                network.name,
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                  color: selected ? AppColors.primary : AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
