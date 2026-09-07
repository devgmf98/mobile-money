import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/code_input.dart';
import '../../widgets/controls.dart';

/// Enter the six-digit code sent by SMS.
///
/// Reached two ways: straight after signing up, and from sign-in when the
/// server reports the account was never verified. Codes last ten minutes, so
/// resending is a first-class action rather than fine print.
class VerifyPhoneScreen extends StatefulWidget {
  const VerifyPhoneScreen({super.key, required this.phone, this.agentId});

  final String phone;

  /// Shown once, on the way through from sign-up: an agent's six-digit ID is
  /// generated server-side and this is the first chance they have to see it.
  final String? agentId;

  @override
  State<VerifyPhoneScreen> createState() => _VerifyPhoneScreenState();
}

class _VerifyPhoneScreenState extends State<VerifyPhoneScreen> {
  final _code = TextEditingController();

  bool _busy = false;
  bool _verified = false;
  String? _error;
  int _resendIn = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startResendCooldown();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  void _startResendCooldown() {
    _timer?.cancel();
    setState(() => _resendIn = 45);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _resendIn -= 1);
      if (_resendIn <= 0) timer.cancel();
    });
  }

  Future<void> _verify() async {
    if (_code.text.length < 6) {
      setState(() => _error = 'Enter the six-digit code we sent you.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      await context.read<AuthController>().verifyPhone(
        phone: widget.phone,
        code: _code.text,
      );
      if (!mounted) return;
      setState(() => _verified = true);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _error = null);
    try {
      await context.read<AuthController>().resendVerification(widget.phone);
      if (!mounted) return;
      AppSnack.info(context, 'A new code is on its way.');
      _startResendCooldown();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_verified) return _VerifiedPanel(agentId: widget.agentId);

    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Verify Phone'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter + 4,
            16,
            AppSizes.gutter + 4,
            28,
          ),
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
                  Icons.sms_outlined,
                  color: AppColors.primary,
                  size: 26,
                ),
              ),
              const SizedBox(height: 22),
              Text(
                'Enter the code',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 6),
              Text(
                'We sent a six-digit code to ${Phone.pretty(widget.phone)}.',
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.45,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 30),

              SizedBox(
                height: 54,
                child: CodeInput(
                  controller: _code,
                  onCompleted: (_) => _verify(),
                ),
              ),
              const SizedBox(height: 20),

              if (_error != null) ...[
                Notice(message: _error!),
                const SizedBox(height: 18),
              ],

              PrimaryButton(label: 'Verify', busy: _busy, onPressed: _verify),
              const SizedBox(height: 16),

              Center(
                child: _resendIn > 0
                    ? Text(
                        'Resend the code in ${_resendIn}s',
                        style: const TextStyle(
                          fontSize: 13,
                          color: AppColors.textMuted,
                        ),
                      )
                    : TextButton(
                        onPressed: _resend,
                        child: const Text('Send a new code'),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shown once verification succeeds. An agent ID appears here because it is
/// generated during sign-up and this is the only moment it is guaranteed to be
/// in front of the person it belongs to.
class _VerifiedPanel extends StatelessWidget {
  const _VerifiedPanel({this.agentId});

  final String? agentId;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.gutter + 4),
          child: Column(
            children: [
              const Spacer(),
              Container(
                width: 84,
                height: 84,
                decoration: const BoxDecoration(
                  color: AppColors.successTint,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 44,
                ),
              ),
              const SizedBox(height: 26),
              Text(
                'Phone verified',
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 8),
              const Text(
                'Your account is ready. Sign in to start sending and receiving '
                'money.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  height: 1.5,
                  color: AppColors.textSecondary,
                ),
              ),

              if (agentId != null && agentId!.isNotEmpty) ...[
                const SizedBox(height: 26),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.primaryTint,
                    borderRadius: BorderRadius.circular(AppSizes.radiusCard),
                  ),
                  child: Column(
                    children: [
                      const Text(
                        'Your Agent ID',
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: AppColors.primaryDeep,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        agentId!,
                        style: const TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 5,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Customers type this to withdraw cash from you. '
                        'Keep it somewhere safe.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          height: 1.4,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const Spacer(),
              PrimaryButton(
                label: 'Continue to Sign In',
                onPressed: () =>
                    Navigator.of(context).popUntil((route) => route.isFirst),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
