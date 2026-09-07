import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/phone.dart';
import '../../../data/api/api_client.dart';
import '../../../data/models/lookup.dart';
import '../../../routing/routes.dart';
import '../../../state/wallet_controller.dart';
import '../../widgets/controls.dart';

/// Find an agent.
///
/// The design shows a map of nearby agents. There is no agent directory on the
/// API — no listing route, and no trading location stored against an account —
/// so a map here would be drawing pins for data that does not exist. What the
/// API does support is a lookup by the six-digit ID on an agent's badge, which
/// is what actually happens at a counter, so that is what this screen does.
/// The map returns when `GET /api/agents` does.
class AgentsScreen extends StatefulWidget {
  const AgentsScreen({super.key, this.embedded = false});

  final bool embedded;

  @override
  State<AgentsScreen> createState() => _AgentsScreenState();
}

class _AgentsScreenState extends State<AgentsScreen> {
  final _agentId = TextEditingController();

  AgentInfo? _agent;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _agentId.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final id = _agentId.text.trim();
    if (id.length != 6) {
      setState(() => _error = 'An agent ID is six digits.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _agent = null;
    });

    try {
      final agent = await context.read<WalletController>().lookupAgent(id);
      if (mounted) setState(() => _agent = agent);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _call(String phone) async {
    final uri = Uri(scheme: 'tel', path: Phone.normalise(phone));
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      AppSnack.error(context, 'This device cannot place calls.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        leading: widget.embedded ? null : const BackButton(),
        title: const Text('Agents'),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.fromLTRB(AppSizes.gutter, 8, AppSizes.gutter, 28),
          children: [
            const Notice.info(
              message:
                  'Agent locations are not published yet, so there is no map. '
                  'Look up an agent by the ID on their badge instead.',
            ),
            const SizedBox(height: 22),

            LabelledField(
              label: 'Agent ID',
              child: TextFormField(
                controller: _agentId,
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.search,
                onFieldSubmitted: (_) => _lookup(),
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 3,
                ),
                decoration: const InputDecoration(
                  hintText: '000000',
                  hintStyle: TextStyle(
                    fontSize: 17,
                    letterSpacing: 3,
                    color: AppColors.textMuted,
                  ),
                  prefixIcon: Icon(Icons.badge_outlined, size: 19),
                ),
              ),
            ),
            const SizedBox(height: 16),
            PrimaryButton(
              label: 'Find Agent',
              icon: Icons.search_rounded,
              busy: _busy,
              onPressed: _lookup,
            ),

            if (_error != null) ...[
              const SizedBox(height: 18),
              Notice(message: _error!),
            ],

            if (_agent != null) ...[
              const SizedBox(height: 22),
              _AgentCard(agent: _agent!, onCall: () => _call(_agent!.phone)),
            ],

            const SizedBox(height: 30),
            const _WhatAgentsDo(),
          ],
        ),
      ),
    );
  }
}

class _AgentCard extends StatelessWidget {
  const _AgentCard({required this.agent, required this.onCall});

  final AgentInfo agent;
  final VoidCallback onCall;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const UserAvatar(initials: 'A', size: 46),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      agent.name,
                      style: const TextStyle(
                        fontSize: 15.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      'Agent ${agent.agentId}',
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onCall,
                icon: const Icon(Icons.phone_rounded),
                color: AppColors.success,
                tooltip: 'Call agent',
              ),
            ],
          ),

          if (agent.isSuspended) ...[
            const SizedBox(height: 14),
            const Notice.warning(
              message: 'This agent is suspended and cannot handle cash today.',
            ),
          ],

          const SizedBox(height: 16),
          PrimaryButton(
            label: 'Withdraw from this agent',
            onPressed: agent.isSuspended
                ? null
                : () => Navigator.of(context).pushNamed(Routes.withdraw),
          ),
        ],
      ),
    );
  }
}

class _WhatAgentsDo extends StatelessWidget {
  const _WhatAgentsDo();

  @override
  Widget build(BuildContext context) {
    const points = [
      (
        Icons.payments_outlined,
        'Pay out cash',
        'Withdraw from your wallet and take the notes in hand.',
      ),
      (
        Icons.savings_outlined,
        'Take deposits',
        'Hand over cash and have it added to your balance.',
      ),
      (
        Icons.verified_user_outlined,
        'Always confirm the name',
        'Check the name that comes back matches the person serving you.',
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(title: 'What agents do'),
        const SizedBox(height: 12),
        for (final (icon, title, body) in points)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: AppColors.primaryTint,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 17, color: AppColors.primary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        body,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.4,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
