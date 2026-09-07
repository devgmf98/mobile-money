import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// Loading placeholders with a shimmer sweep, matching the web app's
/// `.skeleton` treatment.
///
/// One controller drives every placeholder beneath a [Shimmer], and the sweep
/// is applied as a shader over the subtree rather than by animating each
/// block's own colour. The web app's stylesheet makes the same point about its
/// version — a sweep "does not force layout on every frame the way the older
/// shimmer did" — and the shader form is the equivalent here: no rebuild per
/// frame, one repaint.
class Shimmer extends StatefulWidget {
  const Shimmer({super.key, required this.child, this.enabled = true});

  final Widget child;

  /// When false the child paints normally, so the same tree can be used for
  /// the loaded state without swapping widgets.
  final bool enabled;

  @override
  State<Shimmer> createState() => _ShimmerState();
}

class _ShimmerState extends State<Shimmer> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.enabled) _controller.repeat();
  }

  @override
  void didUpdateWidget(Shimmer oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Stopped the moment the content arrives — a ticker left running behind a
    // loaded screen is a wakeup every frame for nothing.
    if (widget.enabled && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.enabled && _controller.isAnimating) {
      _controller.stop();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) => ShaderMask(
        blendMode: BlendMode.srcATop,
        shaderCallback: (bounds) {
          // The highlight travels from off one edge to off the other, so the
          // sweep enters and leaves rather than fading in place.
          final slide = (_controller.value * 2) - 1;
          return LinearGradient(
            begin: Alignment(slide - 0.6, -0.2),
            end: Alignment(slide + 0.6, 0.2),
            colors: const [
              AppColors.divider,
              Color(0xFFF7FBF9),
              AppColors.divider,
            ],
            stops: const [0.35, 0.5, 0.65],
          ).createShader(bounds);
        },
        child: child,
      ),
      child: widget.child,
    );
  }
}

/// A single grey block standing in for text or an icon.
class SkeletonBox extends StatelessWidget {
  const SkeletonBox({super.key, this.width, this.height = 12, this.radius = 6});

  const SkeletonBox.circle({super.key, required double size})
    : width = size,
      height = size,
      radius = size / 2;

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: AppColors.divider,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

/// The shape of a transaction row, while the list is in flight.
///
/// Built to the same measurements as the real tile so the content does not jump
/// when it replaces this.
class SkeletonTransactionTile extends StatelessWidget {
  const SkeletonTransactionTile({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        gradient: AppColors.tileSheen,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.divider),
      ),
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          const SkeletonBox.circle(size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                SkeletonBox(width: 120, height: 12),
                SizedBox(height: 7),
                SkeletonBox(width: 170, height: 10),
              ],
            ),
          ),
          const SizedBox(width: 10),
          const SkeletonBox(width: 74, height: 12),
        ],
      ),
    );
  }
}

/// A short list of them.
class SkeletonTransactionList extends StatelessWidget {
  const SkeletonTransactionList({super.key, this.count = 4});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Shimmer(
      child: Column(
        children: [
          for (var i = 0; i < count; i++) ...[
            const SkeletonTransactionTile(),
            if (i != count - 1) const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

/// The shape of the History figures.
class SkeletonStatTiles extends StatelessWidget {
  const SkeletonStatTiles({super.key});

  @override
  Widget build(BuildContext context) {
    Widget tile() => Container(
      decoration: BoxDecoration(
        gradient: AppColors.tileSheen,
        borderRadius: BorderRadius.circular(AppSizes.radiusCard),
        border: Border.all(color: AppColors.divider),
      ),
      padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: const [
          SkeletonBox(width: 70, height: 9),
          SizedBox(height: 8),
          SkeletonBox(width: 100, height: 14),
        ],
      ),
    );

    return Shimmer(
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(child: tile()),
            const SizedBox(width: 10),
            Expanded(child: tile()),
          ],
        ),
      ),
    );
  }
}
