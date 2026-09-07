import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../routing/routes.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/brand.dart';
import '../../widgets/controls.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';
import 'verify_phone_screen.dart';

/// Sign in.
///
/// The design draws a phone number and a four-digit PIN. The API authenticates
/// on email and password and has no phone-based endpoint, so the fields ask for
/// the credential the account actually has — the PIN in the design is honoured
/// as the app lock on the security screen, which is what a four-digit code is
/// fit to protect.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();

  bool _obscure = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // A session that expired mid-use lands here; saying so is the difference
    // between "the app logged me out" and "the app broke".
    final notice = context.read<AuthController>().expiryNotice;
    if (notice != null) {
      _error = notice;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) context.read<AuthController>().acknowledgeExpiry();
      });
    }
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
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
      await context.read<AuthController>().signIn(
        email: _email.text,
        password: _password.text,
      );
      // The root gate swaps to the home shell on its own; nothing to push.
    } on ApiException catch (error) {
      if (!mounted) return;

      // An unverified phone is not really a failure — it is an unfinished
      // sign-up, so send them to the code screen instead of showing a wall.
      final needsVerification = error.data?['needsVerification'] == true;
      if (needsVerification) {
        final phone = error.data?['phone']?.toString() ?? '';
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => VerifyPhoneScreen(phone: phone),
            settings: const RouteSettings(name: Routes.verifyPhone),
          ),
        );
        return;
      }

      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        // Centred in the viewport rather than pinned to the top: a short form
        // left hanging under the app bar with half a screen of white beneath it
        // reads as an unfinished page.
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSizes.gutter + 4,
              12,
              AppSizes.gutter + 4,
              28,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: constraints.maxHeight - 40,
              ),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (Navigator.of(context).canPop())
                      Align(
                        alignment: Alignment.centerLeft,
                        child: IconButton(
                          onPressed: () => Navigator.of(context).pop(),
                          icon: const Icon(Icons.arrow_back_rounded),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(),
                        ),
                      ),
                    const SizedBox(height: 16),
                    const Center(child: BrandLockup(height: 58)),
                    const SizedBox(height: 34),
                    Text(
                      'Welcome Back!',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Sign in to continue',
                      style: TextStyle(
                        fontSize: 14,
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
                        textInputAction: TextInputAction.next,
                        autocorrect: false,
                        autofillHints: const [AutofillHints.email],
                        decoration: const InputDecoration(
                          hintText: 'you@example.com',
                          prefixIcon: Icon(
                            Icons.mail_outline_rounded,
                            size: 19,
                          ),
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
                    const SizedBox(height: 18),

                    LabelledField(
                      label: 'Password',
                      child: TextFormField(
                        controller: _password,
                        obscureText: _obscure,
                        textInputAction: TextInputAction.done,
                        autofillHints: const [AutofillHints.password],
                        onFieldSubmitted: (_) => _submit(),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          prefixIcon: const Icon(
                            Icons.lock_outline_rounded,
                            size: 19,
                          ),
                          suffixIcon: IconButton(
                            onPressed: () =>
                                setState(() => _obscure = !_obscure),
                            icon: Icon(
                              _obscure
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              size: 19,
                            ),
                            color: AppColors.textMuted,
                          ),
                        ),
                        validator: (value) => (value ?? '').isEmpty
                            ? 'Enter your password'
                            : null,
                      ),
                    ),

                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) => const ForgotPasswordScreen(),
                            settings: const RouteSettings(
                              name: Routes.forgotPassword,
                            ),
                          ),
                        ),
                        child: const Text('Forgot password?'),
                      ),
                    ),
                    const SizedBox(height: 6),

                    PrimaryButton(
                      label: 'Sign In',
                      busy: _busy,
                      onPressed: _submit,
                    ),
                    const SizedBox(height: 18),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          "Don't have an account?",
                          style: TextStyle(
                            fontSize: 13.5,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        TextButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => const RegisterScreen(),
                              settings: const RouteSettings(
                                name: Routes.register,
                              ),
                            ),
                          ),
                          child: const Text('Sign Up'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
