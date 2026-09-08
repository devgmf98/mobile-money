import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/moneypay_api.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/controls.dart';
import '../../widgets/brand_app_bar.dart';

/// Contact customer care.
///
/// Works signed out too — someone locked out of their account is exactly who
/// needs to reach support, and the endpoint is deliberately open for that
/// reason. When there is a session, the fields start pre-filled.
class ContactScreen extends StatefulWidget {
  const ContactScreen({super.key});

  @override
  State<ContactScreen> createState() => _ContactScreenState();
}

class _ContactScreenState extends State<ContactScreen> {
  static const _subjects = <({String id, String label})>[
    (id: 'general', label: 'General enquiry'),
    (id: 'transaction', label: 'A transaction'),
    (id: 'account', label: 'My account'),
    (id: 'agent', label: 'Becoming an agent'),
    (id: 'complaint', label: 'A complaint'),
    (id: 'other', label: 'Something else'),
  ];

  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _phone;
  final _message = TextEditingController();

  String _subject = 'general';
  bool _busy = false;
  bool _sent = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthController>().user;
    _name = TextEditingController(text: user?.name ?? '');
    _email = TextEditingController(text: user?.email ?? '');
    _phone = TextEditingController(text: user?.phone ?? '');
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _message.dispose();
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
      await context.read<SupportApi>().sendMessage(
        name: _name.text,
        email: _email.text,
        phone: _phone.text,
        subject: _subject,
        message: _message.text,
      );
      if (mounted) setState(() => _sent = true);
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
      body: SafeArea(child: _sent ? _sentPanel() : _form()),
    );
  }

  Widget _sentPanel() {
    return Padding(
      padding: const EdgeInsets.all(AppSizes.gutter),
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
              Icons.mark_email_read_outlined,
              color: AppColors.success,
              size: 40,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Message sent',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          const Text(
            'Our team has your message and will get back to you at the email '
            'address you gave.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppColors.textSecondary,
            ),
          ),
          const Spacer(),
          PrimaryButton(
            label: 'Done',
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  Widget _form() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSizes.gutter,
          16,
          AppSizes.gutter,
          32,
        ),
        children: [
          const Text(
            'Tell us what is going on and we will help. If it is about a '
            'specific transaction, include the reference from your history.',
            style: TextStyle(
              fontSize: 14,
              height: 1.5,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 24),

          if (_error != null) ...[
            Notice(message: _error!),
            const SizedBox(height: 18),
          ],

          LabelledField(
            label: 'Your Name',
            child: TextFormField(
              controller: _name,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(hintText: 'Your full name'),
              validator: (value) =>
                  (value ?? '').trim().isEmpty ? 'Enter your name' : null,
            ),
          ),
          const SizedBox(height: 18),

          LabelledField(
            label: 'Email Address',
            child: TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(hintText: 'you@example.com'),
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
            label: 'Phone Number (Optional)',
            child: PhoneField(controller: _phone),
          ),
          const SizedBox(height: 18),

          LabelledField(
            label: 'What is it about?',
            child: DropdownButtonFormField<String>(
              initialValue: _subject,
              items: [
                for (final subject in _subjects)
                  DropdownMenuItem(
                    value: subject.id,
                    child: Text(subject.label),
                  ),
              ],
              onChanged: (value) =>
                  setState(() => _subject = value ?? 'general'),
            ),
          ),
          const SizedBox(height: 18),

          LabelledField(
            label: 'Message',
            child: TextFormField(
              controller: _message,
              maxLines: 6,
              maxLength: 4000,
              decoration: const InputDecoration(
                hintText: 'Tell us what happened',
                alignLabelWithHint: true,
              ),
              // The server refuses anything under ten characters, so the form
              // says so here rather than letting the round trip do it.
              validator: (value) => (value ?? '').trim().length < 10
                  ? 'Please say a little more so we can help'
                  : null,
            ),
          ),

          const SizedBox(height: 12),
          PrimaryButton(label: 'Send Message', busy: _busy, onPressed: _submit),
        ],
      ),
    );
  }
}
