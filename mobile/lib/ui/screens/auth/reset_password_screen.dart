import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/code_input.dart';
import '../../widgets/controls.dart';

/// Step two of a password reset: redeem the code and set a new password.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.email});

  final String? email;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _email = TextEditingController(
    text: widget.email ?? '',
  );
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _code.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    if (_code.text.length < 6) {
      setState(() => _error = 'Enter the six-digit code we sent you.');
      return;
    }
    FocusScope.of(context).unfocus();

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await context.read<AuthController>().resetPassword(
        email: _email.text,
        code: _code.text,
        password: _password.text,
      );
      if (!mounted) return;
      AppSnack.success(
        context,
        'Password updated. Sign in with your new password.',
      );
      Navigator.of(context).popUntil((route) => route.isFirst);
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
        title: const Text('New Password'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter + 4,
            16,
            AppSizes.gutter + 4,
            28,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Set a new password',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 6),
                const Text(
                  'The code we texted you is valid for fifteen minutes.',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.45,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 26),

                if (_error != null) ...[
                  Notice(message: _error!),
                  const SizedBox(height: 18),
                ],

                LabelledField(
                  label: 'Email Address',
                  child: TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      hintText: 'you@example.com',
                      prefixIcon: Icon(Icons.mail_outline_rounded, size: 19),
                    ),
                    validator: (value) => (value ?? '').trim().isEmpty
                        ? 'Enter your email address'
                        : null,
                  ),
                ),
                const SizedBox(height: 18),

                LabelledField(
                  label: 'Reset Code',
                  child: SizedBox(
                    height: 54,
                    child: CodeInput(controller: _code, autofocus: false),
                  ),
                ),
                const SizedBox(height: 18),

                LabelledField(
                  label: 'New Password',
                  child: TextFormField(
                    controller: _password,
                    obscureText: _obscure,
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
                const SizedBox(height: 18),

                LabelledField(
                  label: 'Confirm Password',
                  child: TextFormField(
                    controller: _confirm,
                    obscureText: _obscure,
                    onFieldSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(
                      hintText: 'Repeat your new password',
                      prefixIcon: Icon(Icons.lock_outline_rounded, size: 19),
                    ),
                    validator: (value) => value != _password.text
                        ? 'The two passwords do not match'
                        : null,
                  ),
                ),
                const SizedBox(height: 26),

                PrimaryButton(
                  label: 'Update Password',
                  busy: _busy,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
