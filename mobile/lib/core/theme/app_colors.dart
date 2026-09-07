import 'package:flutter/material.dart';

/// The palette, taken from the React app's mobile design so the two clients
/// look like one product.
///
/// Source of truth is `frontend/src/pages/DashboardMobile.module.css` and
/// `frontend/src/components/BottomNav.module.css`. Where a value here has a
/// comment about contrast, that reasoning came from those files — the web team
/// already worked out which greens are legible at which sizes, and re-deriving
/// it would only risk getting a different answer.
class AppColors {
  const AppColors._();

  // ---------------------------------------------------------------- brand

  /// The call-to-action green: primary buttons, "See All".
  static const Color primary = Color(0xFF00A86B);

  /// The deep green: header gradient, section headings, the active nav tab.
  /// Chosen over [accent] for small text because it measures 5.85:1 on white
  /// where [accent] is only 2.14:1.
  static const Color primaryDark = Color(0xFF087443);

  static const Color primaryDeep = Color(0xFF05512F);

  /// The light green. Decorative only — too pale for small text on white.
  static const Color accent = Color(0xFF34C88E);

  /// Mint fills: secondary action buttons, transaction icon circles.
  static const Color primaryTint = Color(0xFFE8F7F0);

  /// A step deeper, for the pressed state of a mint fill.
  static const Color primaryTintStrong = Color(0xFFD1F0E3);

  // ------------------------------------------------------------- surfaces

  static const Color background = Color(0xFFFFFFFF);
  static const Color surface = Color(0xFFFFFFFF);

  /// The faint green-tinted ground. Deliberately not a cool grey — a neutral
  /// grey next to these greens reads as dirt.
  static const Color canvas = Color(0xFFF4FBF8);
  static const Color field = Color(0xFFF8FCFA);

  static const Color border = Color(0xFFE3F5EC);
  static const Color divider = Color(0xFFEAF2ED);

  // ----------------------------------------------------------------- text

  /// Reserved for the figures that carry the most weight — the balance.
  static const Color textStrong = Color(0xFF0F172A);
  static const Color textPrimary = Color(0xFF1E293B);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  /// Stat tile captions. 5.25:1 on white, where the prettier #7C8B95 was 3.51:1
  /// and failed at the size these are set in.
  static const Color captionStrong = Color(0xFF5F6E7A);

  /// The resting colour of a bottom-nav tab.
  static const Color navInactive = Color(0xFF8B92A9);

  static const Color onPrimary = Color(0xFFFFFFFF);

  // --------------------------------------------------------------- status

  /// Money leaving, and errors.
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerTint = Color(0xFFFEE2E2);

  /// Money arriving.
  static const Color success = Color(0xFF16A34A);
  static const Color successTint = Color(0xFFDCFCE7);

  /// Commission, and anything pending — neither in nor out.
  static const Color warning = Color(0xFFD97706);
  static const Color warningTint = Color(0xFFFEF3C7);

  static const Color info = Color(0xFF087443);
  static const Color infoTint = Color(0xFFE8F7F0);

  // ------------------------------------------------------------ gradients

  /// The dashboard header. CSS: `linear-gradient(135deg, #087443, #00A86B)`.
  static const LinearGradient headerGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryDark, primary],
  );

  /// The wash across a card — white for the top half, easing into the faintest
  /// green at the bottom corner. CSS: `linear-gradient(160deg, …)`.
  static const LinearGradient cardSheen = LinearGradient(
    begin: Alignment(-0.36, -1),
    end: Alignment(0.36, 1),
    colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0xFFF2FBF7)],
    stops: [0, 0.52, 1],
  );

  /// The same idea, a touch cooler, for the smaller tiles.
  static const LinearGradient tileSheen = LinearGradient(
    begin: Alignment(-0.36, -1),
    end: Alignment(0.36, 1),
    colors: [Color(0xFFFFFFFF), Color(0xFFFFFFFF), Color(0xFFF4FBF8)],
    stops: [0, 0.55, 1],
  );

  /// The brand mark.
  static const LinearGradient brandGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [primaryDark, accent],
  );

  /// The ground behind the phone frame in a desktop browser.
  static const LinearGradient webBackdrop = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0xFFEFF7F3), Color(0xFFE6EFF0)],
  );

  // -------------------------------------------------------------- shadows

  /// The balance card's lift. Two layers of brand green rather than neutral
  /// grey: a wide soft one that lifts the card off the page, and a tight one
  /// under the edge so the lift reads as depth instead of a blur.
  static const List<BoxShadow> cardLift = [
    BoxShadow(
      color: Color(0x33087443),
      blurRadius: 34,
      spreadRadius: -10,
      offset: Offset(0, 16),
    ),
    BoxShadow(
      color: Color(0x1A087443),
      blurRadius: 10,
      spreadRadius: -2,
      offset: Offset(0, 4),
    ),
  ];

  /// A quarter of the strength, so a row of tiles does not compete with the
  /// balance card above it.
  static const List<BoxShadow> tileLift = [
    BoxShadow(
      color: Color(0x2E087443),
      blurRadius: 16,
      spreadRadius: -8,
      offset: Offset(0, 6),
    ),
  ];

  /// The bottom bar, lifting off the page it sits over.
  static const List<BoxShadow> navLift = [
    BoxShadow(color: Color(0x0F000000), blurRadius: 16, offset: Offset(0, -2)),
  ];
}
