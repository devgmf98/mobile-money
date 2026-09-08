import 'dart:math' as math;

import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'motion.dart';

/// Layout constants the design repeats: a 20px screen gutter, 16px card
/// radius, 12px control radius, 52px tall primary buttons.
class AppSizes {
  const AppSizes._();

  static const double gutter = 20;
  static const double gap = 16;
  static const double gapSm = 12;
  static const double gapXs = 8;

  static const double radiusCard = 16;
  static const double radiusControl = 12;
  static const double radiusPill = 999;

  static const double buttonHeight = 52;
}

/// A single Material 3 theme. The design is light-only — every screen in it
/// sits on white or the faint grey canvas — so there is no dark counterpart to
/// keep in step.
class AppTheme {
  const AppTheme._();

  static const SystemUiOverlayStyle lightOverlay = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemNavigationBarColor: AppColors.background,
    systemNavigationBarIconBrightness: Brightness.dark,
  );

  static ThemeData get light {
    const scheme = ColorScheme.light(
      primary: AppColors.primary,
      onPrimary: AppColors.onPrimary,
      primaryContainer: AppColors.primaryTint,
      onPrimaryContainer: AppColors.primaryDeep,
      secondary: AppColors.accent,
      onSecondary: AppColors.onPrimary,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.danger,
      onError: AppColors.onPrimary,
      outline: AppColors.border,
    );

    final base = ThemeData(colorScheme: scheme, useMaterial3: true);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.background,
      // One transition everywhere except Apple platforms, which keep their own
      // so the edge swipe back that iOS users reach for still works.
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: AppPageTransitionsBuilder(),
          TargetPlatform.fuchsia: AppPageTransitionsBuilder(),
          TargetPlatform.linux: AppPageTransitionsBuilder(),
          TargetPlatform.windows: AppPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
          TargetPlatform.macOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      textTheme: _textTheme(base.textTheme),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        foregroundColor: AppColors.textPrimary,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: true,
        systemOverlayStyle: lightOverlay,
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.divider,
        thickness: 1,
        space: 1,
      ),
      cardTheme: CardThemeData(
        color: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusCard),
          side: const BorderSide(color: AppColors.border),
        ),
      ),
      inputDecorationTheme: _inputTheme(),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: AppColors.onPrimary,
          disabledBackgroundColor: const Color(0xFF9BD3BA),
          disabledForegroundColor: Colors.white,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          elevation: 0,
          textStyle: const TextStyle(
            fontSize: 15.5,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusControl),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.primary,
          minimumSize: const Size.fromHeight(AppSizes.buttonHeight),
          side: const BorderSide(color: AppColors.border),
          textStyle: const TextStyle(
            fontSize: 15.5,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusControl),
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.primary,
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.textPrimary,
        contentTextStyle: const TextStyle(color: Colors.white, fontSize: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        ),
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.primary,
        linearTrackColor: AppColors.primaryTint,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.textSecondary,
        contentPadding: EdgeInsets.symmetric(horizontal: AppSizes.gutter),
      ),
    );
  }

  static TextTheme _textTheme(TextTheme base) {
    // The platform's own UI font — Roboto on Android, San Francisco on iOS.
    // Deliberately not a downloaded webfont: the first screen a customer sees
    // must render identically whether or not they have a connection.
    return base
        .copyWith(
          displaySmall: const TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.6,
          ),
          headlineSmall: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
          ),
          titleLarge: const TextStyle(
            fontSize: 19,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.2,
          ),
          titleMedium: const TextStyle(
            fontSize: 15.5,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.1,
          ),
          bodyLarge: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
          bodyMedium: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w400,
          ),
          bodySmall: const TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w400,
          ),
          labelLarge: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
          labelSmall: const TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.1,
          ),
        )
        .apply(
          bodyColor: AppColors.textPrimary,
          displayColor: AppColors.textPrimary,
        );
  }

  static InputDecorationTheme _inputTheme() {
    OutlineInputBorder border(Color color, [double width = 1]) {
      return OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        borderSide: BorderSide(color: color, width: width),
      );
    }

    return InputDecorationTheme(
      filled: true,
      fillColor: AppColors.field,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      hintStyle: const TextStyle(
        color: AppColors.textMuted,
        fontSize: 15,
        fontWeight: FontWeight.w400,
      ),
      labelStyle: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
      floatingLabelBehavior: FloatingLabelBehavior.never,
      enabledBorder: border(AppColors.border),
      focusedBorder: border(AppColors.primary, 1.4),
      errorBorder: border(AppColors.danger),
      focusedErrorBorder: border(AppColors.danger, 1.4),
      disabledBorder: border(AppColors.divider),
      errorStyle: const TextStyle(color: AppColors.danger, fontSize: 12.5),
    );
  }
}

/// How every scrollable in the app behaves.
///
/// Set once on [MaterialApp.scrollBehavior] so it reaches all of them, rather
/// than being remembered at each ListView.
///
/// Android's default is [ClampingScrollPhysics]: a list stops dead at its end
/// and answers a flick past it with a coloured glow. That stop is what reads
/// as the app not scrolling smoothly -- the motion ends in one frame instead
/// of easing out. Bouncing physics decelerates instead, and carries the
/// overscroll in the list itself, so nothing has to be painted over the
/// content to say the end has been reached.
///
/// The drag devices are widened at the same time. A phone only ever sends
/// touch, but the same build runs in a desktop browser, where by default a
/// mouse cannot drag a list at all -- only the wheel scrolls it.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const TautBouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());

  /// No glow: it exists to announce the end of a list, which the bounce above
  /// now does with the content itself.
  @override
  Widget buildOverscrollIndicator(
    BuildContext context,
    Widget child,
    ScrollableDetails details,
  ) => child;

  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
  };
}

/// Bouncing, but on a shorter leash.
///
/// Plain [BouncingScrollPhysics] is tuned for iOS, where a long elastic pull is
/// the house style. On a list of transactions it reads as the page coming away
/// from the top of the screen -- the stretch was the complaint, not the bounce.
///
/// [frictionFactor] is what decides how much of a drag past the edge becomes
/// movement. The default starts at 0.52 and falls off as you pull; this starts
/// at less than half that, so the list gives enough to show it has reached the
/// end and to reach a RefreshIndicator, and no further.
///
/// The deceleration rate is Android's faster one as well, so a fling settles
/// rather than gliding on the way an iOS list does.
class TautBouncingScrollPhysics extends BouncingScrollPhysics {
  const TautBouncingScrollPhysics({super.parent})
    : super(decelerationRate: ScrollDecelerationRate.fast);

  @override
  TautBouncingScrollPhysics applyTo(ScrollPhysics? ancestor) =>
      TautBouncingScrollPhysics(parent: buildParent(ancestor));

  @override
  double frictionFactor(double overscrollFraction) =>
      0.22 * math.pow(1 - overscrollFraction, 2);
}
