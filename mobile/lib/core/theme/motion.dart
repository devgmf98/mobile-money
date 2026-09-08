import 'dart:async';

import 'package:flutter/material.dart';

/// The app's motion vocabulary, in one place so screens do not each invent
/// their own timing.
///
/// Everything here is short. This is a wallet: people open it to check a
/// balance or pay someone, often standing at a counter, and an animation they
/// have to wait through is a tax on every single use. Durations are set to the
/// point where a transition reads as motion rather than as a delay.
class Motion {
  const Motion._();

  /// Route pushes and pops.
  static const Duration page = Duration(milliseconds: 260);

  /// Content settling into place on arrival.
  static const Duration enter = Duration(milliseconds: 320);

  /// Small state flips — a value changing, a chip selecting.
  static const Duration quick = Duration(milliseconds: 180);

  /// Decelerating: fast to start, easing into rest. The right curve for
  /// something arriving.
  static const Curve entering = Curves.easeOutCubic;

  /// Accelerating away.
  static const Curve leaving = Curves.easeInCubic;
}

/// A page transition: the arriving screen slides in from the trailing edge as
/// it fades up, while the one it covers eases the other way.
///
/// Translation and nothing else on the outgoing page, on purpose. An earlier
/// version scaled both pages for a sense of depth, which meant two full-screen
/// resamples plus two `saveLayer`s on every frame of every push — it looked
/// considered on a desktop and dropped frames on a phone. A slide is a paint
/// offset and costs nothing; the single fade on the arriving page is the only
/// layer this composites, and it is over before the movement is.
///
/// The travel is deliberately short — a tenth of the width, not a full screen.
/// A full-width slide on every push turns a four-tap task into four seconds of
/// sliding, and reads as sluggish however fast the curve is.
class AppPageTransitionsBuilder extends PageTransitionsBuilder {
  const AppPageTransitionsBuilder();

  @override
  Duration get transitionDuration => Motion.page;

  @override
  Widget buildTransitions<T>(
    PageRoute<T>? route,
    BuildContext? context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final incoming = CurvedAnimation(
      parent: animation,
      curve: Motion.entering,
      reverseCurve: Motion.leaving,
    );

    final outgoing = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Motion.entering,
      reverseCurve: Motion.leaving,
    );

    return SlideTransition(
      // The page being covered gives way a little. That, not a scale, is what
      // makes the two read as a stack rather than a cross-fade.
      position: Tween<Offset>(
        begin: Offset.zero,
        end: const Offset(-0.055, 0),
      ).animate(outgoing),
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0.10, 0),
          end: Offset.zero,
        ).animate(incoming),
        child: FadeTransition(
          // Solid well before it stops moving, so the page is never both
          // translucent and still.
          opacity: Tween<double>(begin: 0, end: 1).animate(
            CurvedAnimation(
              parent: animation,
              curve: const Interval(0, 0.55, curve: Curves.easeOut),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Hold work back until the screen has finished arriving.
///
/// [FadeSlideIn] below already does this for its own animation, and the reason
/// given there applies just as much to loading data: the heaviest moment of a
/// navigation is the push itself, and a screen that fetches on init spends it
/// building a response as well. The request is cheap -- it is the setState and
/// the rebuild of a full list landing mid-transition that shows, as a hitch
/// partway through the slide.
///
/// Screens here nearly always have something to draw already, because the
/// controllers hold the last known state, so waiting costs a refresh a few
/// hundred milliseconds and no visible emptiness.
///
/// Safe to call in initState: the route is read on the first frame, not now.
mixin AfterRouteSettles<T extends StatefulWidget> on State<T> {
  Animation<double>? _routeArrival;
  VoidCallback? _queued;

  /// Run [action] once this screen's push animation has finished -- or right
  /// away when there is no animation to wait for, as on the first screen of
  /// the app or a tab swap inside the shell.
  void afterRouteSettles(VoidCallback action) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;

      final arrival = ModalRoute.of(context)?.animation;
      if (arrival == null || arrival.isCompleted) {
        action();
        return;
      }

      _queued = action;
      _routeArrival = arrival;
      arrival.addStatusListener(_onArrival);
    });
  }

  void _onArrival(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _detach();
    if (mounted) _queued?.call();
    _queued = null;
  }

  void _detach() {
    _routeArrival?.removeStatusListener(_onArrival);
    _routeArrival = null;
  }

  @override
  void dispose() {
    // A screen dismissed mid-push would otherwise leave a listener on an
    // animation that outlives it.
    _detach();
    super.dispose();
  }
}

/// Content that fades and lifts into place when it first appears.
///
/// Used for the pieces of a screen that arrive together — a card, a section —
/// with [delay] staggering them so the screen assembles rather than snapping.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.offset = 14,
  });

  final Widget child;
  final Duration delay;

  /// How far the child travels up into place, as a percentage of its own
  /// height. Ten is a gentle lift; much more reads as a slide.
  final double offset;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: Motion.enter,
  );

  late final Animation<double> _fade = CurvedAnimation(
    parent: _controller,
    curve: Motion.entering,
  );

  Timer? _delay;
  Animation<double>? _routeAnimation;
  bool _scheduled = false;

  /// Set once the entrance has played, after which this widget gets out of the
  /// way entirely.
  bool _settled = false;

  @override
  void initState() {
    super.initState();
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted) {
        setState(() => _settled = true);
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_scheduled) return;
    _scheduled = true;

    // Wait for the page to finish arriving before anything on it starts
    // moving. A screen with four staggered sections used to run all four
    // alongside the route transition, so the heaviest moment of a navigation
    // was also the moment it was asked to do the most — which is what made
    // pushing a page feel like it stuttered.
    final route = ModalRoute.of(context)?.animation;
    if (route == null || route.isCompleted) {
      _begin();
      return;
    }

    _routeAnimation = route;
    route.addStatusListener(_onRouteStatus);
  }

  void _onRouteStatus(AnimationStatus status) {
    if (status != AnimationStatus.completed) return;
    _routeAnimation?.removeStatusListener(_onRouteStatus);
    _routeAnimation = null;
    if (mounted) _begin();
  }

  void _begin() {
    if (widget.delay == Duration.zero) {
      _controller.forward();
    } else {
      _delay = Timer(widget.delay, _controller.forward);
    }
  }

  @override
  void dispose() {
    // Both cancelled, not left to fire: forwarding a disposed controller
    // throws, and a screen dismissed mid-transition would do exactly that.
    _routeAnimation?.removeStatusListener(_onRouteStatus);
    _delay?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // The whole point of the flag. A SlideTransition leaves a
    // FractionalTranslation in the tree for good, and an entrance animation
    // wrapped permanently around a section of a scrolling list makes that
    // section's text resample against a transform on every frame — which reads,
    // correctly, as the text shaking as the list moves. Once the animation has
    // played there is nothing left for it to do, so it stops being there.
    if (_settled) return widget.child;

    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        // A fraction of the child's own height, so one widget suits a card and
        // a whole section alike.
        position: Tween<Offset>(
          begin: Offset(0, widget.offset / 100),
          end: Offset.zero,
        ).animate(_fade),
        child: widget.child,
      ),
    );
  }
}
