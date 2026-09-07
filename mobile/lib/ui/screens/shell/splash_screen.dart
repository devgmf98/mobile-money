import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../widgets/brand.dart';

/// Held while the stored session is read.
///
/// It continues the Android launch window rather than replacing it: that window
/// paints the same logo on the same white ground, so the handover from the
/// platform splash to the first Flutter frame is invisible. The logo settling
/// into place is the only motion, and it starts from where the static one sat.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 620),
  )..forward();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final logo = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.7, curve: Curves.easeOutBack),
    );

    // The spinner is held back so it only appears if reading the session is
    // actually taking a moment. On a fast launch it never shows at all, which
    // is better than a spinner that flashes for two frames.
    final spinner = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.55, 1, curve: Curves.easeOut),
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          Align(
            alignment: const Alignment(0, -0.12),
            child: AnimatedBuilder(
              animation: logo,
              builder: (context, child) => Opacity(
                opacity: logo.value.clamp(0, 1),
                child: Transform.scale(
                  scale: 0.92 + (0.08 * logo.value.clamp(0, 1)),
                  child: child,
                ),
              ),
              child: const BrandLockup(height: 78),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                FadeTransition(
                  opacity: spinner,
                  child: const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2.4),
                  ),
                ),
                const SizedBox(height: 34),
                BrandWave(height: MediaQuery.sizeOf(context).height * 0.14),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
