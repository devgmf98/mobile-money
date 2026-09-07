import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Keeps the app phone-shaped on a desktop browser.
///
/// Every layout in this app is a phone layout — a single column, a balance card
/// meant to be about a thumb's reach across, tap targets sized for a finger.
/// Given a 1440px window, Flutter web will happily stretch all of that edge to
/// edge, and the result reads as broken rather than as a wide design.
///
/// So above a phone-ish width the app is centred in a phone-sized frame. Two
/// things make it actually look like a phone rather than a large screen shrunk
/// into a box:
///
///  * The frame's size is pushed back into [MediaQuery], so `SafeArea`,
///    `MediaQuery.sizeOf` and every other size query inside answer with the
///    frame rather than the window. Without that the content would be the right
///    width while still laying itself out against a 1440px screen.
///  * Text scaling is pinned to 1.0. A browser at 125% zoom, or a desktop with
///    OS-level text scaling, reports a scale factor that Flutter honours — so
///    every figure and label rendered a third larger than it would on a phone,
///    which is exactly what makes a phone frame read as a big screen.
class WebDeviceFrame extends StatelessWidget {
  const WebDeviceFrame({super.key, required this.child});

  final Widget child;

  /// An iPhone 14 / Pixel 7 in logical pixels — the width these layouts were
  /// drawn for.
  static const double _frameWidth = 390;

  /// A modern phone is around 19.5:9. Capping the height by ratio stops a tall
  /// desktop window from stretching the frame into a letterbox that no handset
  /// resembles.
  static const double _aspectRatio = 19.5 / 9;

  /// Below this the window is treated as a phone and the app fills it. The
  /// margin over [_frameWidth] keeps a narrow desktop window from getting a
  /// frame with no room to breathe around it.
  static const double _minWidthForFrame = _frameWidth + 130;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);

    if (media.size.width < _minWidthForFrame) {
      // A real device, or a browser already at phone width. Keep the host's
      // own text scaling — someone who has turned it up needs it — but hold it
      // inside a band, because money figures are laid out tightly and a 2x
      // scale turns a balance card into an overflow stripe.
      return MediaQuery(
        data: media.copyWith(
          textScaler: media.textScaler.clamp(
            minScaleFactor: 0.9,
            maxScaleFactor: 1.3,
          ),
        ),
        child: child,
      );
    }

    final frameHeight = math.min(
      media.size.height - 48,
      _frameWidth * _aspectRatio,
    );

    return DecoratedBox(
      decoration: const BoxDecoration(gradient: AppColors.webBackdrop),
      child: Center(
        child: Container(
          width: _frameWidth,
          height: frameHeight,
          decoration: BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.circular(30),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F2A20).withValues(alpha: 0.18),
                blurRadius: 48,
                spreadRadius: -8,
                offset: const Offset(0, 20),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: MediaQuery(
            data: media.copyWith(
              size: Size(_frameWidth, frameHeight),
              // Exactly a phone's scale — see the class comment.
              textScaler: TextScaler.noScaling,
              // The frame has no notch, no home indicator and no software
              // keyboard, so anything SafeArea would inset for is gone.
              padding: EdgeInsets.zero,
              viewPadding: EdgeInsets.zero,
              viewInsets: EdgeInsets.zero,
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
