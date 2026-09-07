import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// The MoneyPay artwork, shared with the web app.
///
/// These are the same two files the React app ships in `frontend/src/assets`,
/// copied into this project so both clients show one logo. They are painted
/// rather than reconstructed: the mark has a navy handset, a green wallet and a
/// gold coin, and no amount of drawing primitives was going to match that.
class BrandAssets {
  const BrandAssets._();

  /// The mark alone — handset, wallet, coin. 128x128, square, with alpha.
  static const String icon = 'assets/images/mp-icon.png';

  /// The full lockup — mark plus the "MoneyPay / Mobile money" wordmark.
  /// 480x179, so a little under 2.7:1.
  static const String logo = 'assets/images/mp-logo.png';

  static const double logoAspect = 480 / 179;
}

/// The mark on its own, for places too small or too busy for the wordmark.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 44});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      BrandAssets.icon,
      width: size,
      height: size,
      filterQuality: FilterQuality.medium,
      // The mark is the app's identity; a missing asset should degrade to
      // something recognisable rather than a broken-image glyph.
      errorBuilder: (context, error, stack) => Icon(
        Icons.account_balance_wallet_rounded,
        size: size * 0.8,
        color: AppColors.primaryDark,
      ),
    );
  }
}

/// The full logo: mark plus the "MoneyPay / Mobile money" wordmark.
///
/// Nothing but the artwork. It used to add a "South Sudan" line underneath,
/// which sat directly below the tagline already inside the image - two straplines
/// stacked on each other - and needed an indent fudge to line up with the type
/// it was not part of. Alignment comes from whatever column this sits in.
class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.height = 56});

  /// The height of the artwork. Width follows from its aspect ratio.
  ///
  /// Worth keeping generous: the wordmark is a little over a third of the
  /// image's height, so a lockup much under 48 leaves the tagline unreadable.
  final double height;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      BrandAssets.logo,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      errorBuilder: (context, error, stack) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          BrandMark(size: height * 0.8),
          const SizedBox(width: 8),
          Text(
            'MoneyPay',
            style: TextStyle(
              fontSize: height * 0.46,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

/// The green wave that anchors the welcome and splash screens.
class BrandWave extends StatelessWidget {
  const BrandWave({super.key, this.height = 180});

  final double height;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _WavePainter()),
    );
  }
}

class _WavePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Two overlapping crests, the back one paler, so the shape reads as a wave
    // rather than a single blob.
    final back = Path()
      ..moveTo(0, h * 0.45)
      ..cubicTo(w * 0.25, h * 0.05, w * 0.55, h * 0.85, w, h * 0.30)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final front = Path()
      ..moveTo(0, h * 0.68)
      ..cubicTo(w * 0.30, h * 0.30, w * 0.62, h, w, h * 0.58)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final rect = Offset.zero & size;

    canvas.drawPath(
      back,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            AppColors.accent.withValues(alpha: 0.55),
            AppColors.primary.withValues(alpha: 0.45),
          ],
        ).createShader(rect),
    );

    canvas.drawPath(
      front,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.bottomLeft,
          end: Alignment.topRight,
          colors: [AppColors.primaryDark, AppColors.accent],
        ).createShader(rect),
    );
  }

  @override
  bool shouldRepaint(_WavePainter oldDelegate) => false;
}
