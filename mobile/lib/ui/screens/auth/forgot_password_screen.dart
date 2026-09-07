import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/controls.dart';
import 'reset_password_screen.dart';

/// Step one of a password reset: name the account.
///
/// The server answers identically whether or not the email is registered — so
/// this screen cannot be used to discover who has an account, and the copy is
/// written to match ("if that email is registered…") rather than implying the
/// code definitely went out.
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();

  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
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
      await context.read<AuthController>().forgotPassword(_email.text);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => ResetPasswordScreen(email: _email.text.trim()),
          settings: const RouteSettings(name: Routes.resetPassword),
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
        title: const Text('Reset Password'),
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
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: AppColors.primaryTint,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.lock_reset_rounded,
                    color: AppColors.primary,
                    size: 26,
                  ),
                ),
                const SizedBox(height: 22),
                Text(
                  'Forgot your password?',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 6),
                const Text(
                  'Enter the email on your account. If it is registered, we '
                  'will text a reset code to the phone number we have on file.',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.5,
                    color: AppColors.textSecondary,
                  ),
                ),
                const SizedBox(height: 28),

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
                    autofocus: true,
                    onFieldSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(
                      hintText: 'you@example.com',
                      prefixIcon: Icon(Icons.mail_outline_rounded, size: 19),
                    ),
                    validator: (value) {
                      final text = (value ?? '').trim();
                      if (text.isEmpty) return 'Enter your email address';
                      if (!text.contains('@')) {
                        return 'That does not look like an email address';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 26),

                PrimaryButton(
                  label: 'Send Reset Code',
                  busy: _busy,
                  onPressed: _submit,
                ),
                const SizedBox(height: 14),

                Center(
                  child: TextButton(
                    onPressed: () => Navigator.of(context).pushReplacement(
                      MaterialPageRoute<void>(
                        builder: (_) => const ResetPasswordScreen(),
                        settings: const RouteSettings(
                          name: Routes.resetPassword,
                        ),
                      ),
                    ),
                    child: const Text('I already have a code'),
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
