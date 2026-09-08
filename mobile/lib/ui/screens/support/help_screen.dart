import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../data/api/api_client.dart';
import '../../../data/api/moneypay_api.dart';
import '../../../data/models/lookup.dart';
import '../../../routing/routes.dart';
import '../../widgets/controls.dart';

/// The help centre.
///
/// Readable signed out as well as in — the people who most need it are often
/// the ones who cannot get into their account.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  final _search = TextEditingController();

  List<HelpArticle> _articles = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final articles = await context.read<SupportApi>().helpArticles();
      if (mounted) setState(() => _articles = articles);
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final visible = _articles
        .where((article) => article.matchesQuery(_search.text))
        .toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        leading: const BackButton(),
        title: const Text('Help & Support'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          color: AppColors.primary,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSizes.gutter,
                  8,
                  AppSizes.gutter,
                  12,
                ),
                child: TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    hintText: 'Search for an answer',
                    prefixIcon: Icon(Icons.search_rounded, size: 19),
                  ),
                ),
              ),
              Expanded(child: _body(visible)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _body(List<HelpArticle> visible) {
    if (_loading && _articles.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_articles.isEmpty) {
      return ListView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            icon: Icons.help_outline_rounded,
            title: _error == null
                ? 'No help articles yet'
                : 'Could not load the help centre',
            message:
                _error ??
                'Answers to common questions will appear here. In the '
                    'meantime, get in touch and we will help directly.',
            action: FilledButton(
              onPressed: () => _error == null
                  ? Navigator.of(context).pushNamed(Routes.contact)
                  : _load(),
              child: Text(_error == null ? 'Contact us' : 'Try again'),
            ),
          ),
        ],
      );
    }

    if (visible.isEmpty) {
      return ListView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        children: [
          const SizedBox(height: 40),
          EmptyState(
            icon: Icons.search_off_rounded,
            title: 'Nothing matched',
            message: 'Try different words, or get in touch with us.',
            action: OutlinedButton(
              onPressed: () => Navigator.of(context).pushNamed(Routes.contact),
              child: const Text('Contact us'),
            ),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSizes.gutter,
        0,
        AppSizes.gutter,
        28,
      ),
      itemCount: visible.length + 1,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        if (index == visible.length) return const _StillStuck();
        return _ArticleTile(article: visible[index]);
      },
    );
  }
}

class _ArticleTile extends StatelessWidget {
  const _ArticleTile({required this.article});

  final HelpArticle article;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Theme(
        // The default divider on an expansion tile fights the card border.
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          // Counting a read only when an article is actually opened is what
          // the separate endpoint exists for.
          onExpansionChanged: (expanded) {
            if (expanded) {
              context
                  .read<SupportApi>()
                  .markHelpRead(article.slug)
                  .catchError((_) {});
            }
          },
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          title: Text(
            article.question,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 3),
            child: Text(
              article.categoryLabel,
              style: const TextStyle(
                fontSize: 11.5,
                color: AppColors.textMuted,
              ),
            ),
          ),
          children: [
            Text(
              article.answer,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.6,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StillStuck extends StatelessWidget {
  const _StillStuck();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 18),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: AppColors.primaryTint,
          borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Still stuck?',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            const Text(
              'Send us a message and we will get back to you.',
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 14),
            PrimaryButton(
              label: 'Contact Us',
              onPressed: () => Navigator.of(context).pushNamed(Routes.contact),
            ),
          ],
        ),
      ),
    );
  }
}
