import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/countries.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/brand.dart';
import '../../widgets/controls.dart';
import '../../widgets/country_phone_field.dart';
import 'verify_phone_screen.dart';

/// Create an account — as a customer, or as an agent.
///
/// Agents get a six-digit ID generated for them server-side; it is the code
/// customers type on the withdraw screen, so it is shown as soon as it exists.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  /// The dialling code beside the phone field. South Sudan by default, since
  /// that is where all but a few accounts are opened.
  Country _country = Countries.defaultCountry;

  bool _asAgent = false;
  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
    });

    final phone = Phone.compose(_country.dial, _phone.text);

    try {
      final result = await context.read<AuthController>().register(
        name: _name.text,
        email: _email.text,
        phone: phone,
        password: _password.text,
        asAgent: _asAgent,
      );
      if (!mounted) return;

      final agentId = result['agentId']?.toString();

      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => VerifyPhoneScreen(phone: phone, agentId: agentId),
          settings: const RouteSettings(name: Routes.verifyPhone),
        ),
      );
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
        leading: const BackButton(),
        title: const Text('Create Account'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter + 4,
            8,
            AppSizes.gutter + 4,
            28,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Center(child: BrandLockup(height: 52)),
                const SizedBox(height: 26),

                if (_error != null) ...[
                  Notice(message: _error!),
                  const SizedBox(height: 18),
                ],

                LabelledField(
                  label: 'Full Name',
                  child: TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      hintText: 'John Doe',
                      prefixIcon: Icon(Icons.person_outline_rounded, size: 19),
                    ),
                    validator: (value) => (value ?? '').trim().length < 2
                        ? 'Enter your full name'
                        : null,
                  ),
                ),
                const SizedBox(height: 16),

                LabelledField(
                  label: 'Email Address',
                  child: TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textInputAction: TextInputAction.next,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      hintText: 'you@example.com',
                      prefixIcon: Icon(Icons.mail_outline_rounded, size: 19),
                    ),
                    validator: (value) {
                      final text = (value ?? '').trim();
                      if (text.isEmpty) return 'Enter your email address';
                      if (!text.contains('@') || !text.contains('.')) {
                        return 'That does not look like an email address';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 16),

                LabelledField(
                  label: 'Phone Number',
                  child: CountryPhoneField(
                    controller: _phone,
                    onChanged: (_) => setState(() {}),
                    country: _country,
                    onCountryChanged: (country) =>
                        setState(() => _country = country),
                    validator: (value) => Phone.looksValidLocal(value ?? '')
                        ? null
                        : 'Enter a valid phone number',
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'We send a verification code to '
                  '${Phone.compose(_country.dial, _phone.text).isEmpty ? _country.dial : Phone.compose(_country.dial, _phone.text)}.',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
                const SizedBox(height: 16),

                LabelledField(
                  label: 'Password',
                  child: TextFormField(
                    controller: _password,
                    obscureText: _obscure,
                    textInputAction: TextInputAction.next,
                    decoration: InputDecoration(
                      hintText: 'At least 6 characters',
                      prefixIcon: const Icon(
                        Icons.lock_outline_rounded,
                        size: 19,
                      ),
                      suffixIcon: IconButton(
                        onPressed: () => setState(() => _obscure = !_obscure),
                        icon: Icon(
                          _obscure
                              ? Icons.visibility_off_outlined
                              : Icons.visibility_outlined,
                          size: 19,
                        ),
                        color: AppColors.textMuted,
                      ),
                    ),
                    validator: (value) => (value ?? '').length < 6
                        ? 'Use at least 6 characters'
                        : null,
                  ),
                ),
                const SizedBox(height: 16),

                LabelledField(
                  label: 'Confirm Password',
                  child: TextFormField(
                    controller: _confirm,
                    obscureText: _obscure,
                    textInputAction: TextInputAction.done,
                    onFieldSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(
                      hintText: 'Repeat your password',
                      prefixIcon: Icon(Icons.lock_outline_rounded, size: 19),
                    ),
                    validator: (value) => value != _password.text
                        ? 'The two passwords do not match'
                        : null,
                  ),
                ),
                const SizedBox(height: 20),

                _AgentToggle(
                  value: _asAgent,
                  onChanged: (value) => setState(() => _asAgent = value),
                ),
                const SizedBox(height: 22),

                PrimaryButton(
                  label: 'Create Account',
                  busy: _busy,
                  onPressed: _submit,
                ),
                const SizedBox(height: 14),

                const Text(
                  'By creating an account you agree to the MoneyPay Terms of '
                  'Service and Privacy Policy.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.45,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AgentToggle extends StatelessWidget {
  const _AgentToggle({required this.value, required this.onChanged});

  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: value ? AppColors.primaryTint : AppColors.canvas,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        border: Border.all(color: value ? AppColors.primary : AppColors.border),
      ),
      child: Row(
        children: [
          Icon(
            Icons.storefront_rounded,
            size: 20,
            color: value ? AppColors.primary : AppColors.textSecondary,
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Register as an agent',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                ),
                SizedBox(height: 2),
                Text(
                  'Take deposits and pay out cash for customers.',
                  style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
