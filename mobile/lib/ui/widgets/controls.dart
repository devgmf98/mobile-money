import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/formatters.dart';

/// The primary action at the foot of a form.
///
/// Owns its own busy state so no screen has to swap the label for a spinner by
/// hand, and keeps the button's width while it spins — a control that resizes
/// mid-tap is how people double-submit a payment.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.busy = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return FilledButton(
      onPressed: busy ? null : onPressed,
      child: busy
          ? const SizedBox.square(
              dimension: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                color: Colors.white,
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18),
                  const SizedBox(width: 8),
                ],
                Text(label),
              ],
            ),
    );
  }
}

/// An invisible, focusable place to park focus.
///
/// Calling `unfocus()` before opening a modal is not enough to keep the
/// keyboard down. A route's focus scope remembers which child last held focus
/// and restores it when the sheet covering it pops — so on a form whose last
/// field is a text input, confirming a payment popped the sheet and brought the
/// keyboard straight back up over the transition, showing "Add a note" at the
/// exact moment the money moved.
///
/// Parking focus here instead gives the scope something to restore that has no
/// keyboard of its own. Deterministic, where a second `unfocus()` is a race
/// against the pop.
class KeyboardSink extends StatelessWidget {
  const KeyboardSink({super.key, required this.node});

  final FocusNode node;

  @override
  Widget build(BuildContext context) {
    return Focus(
      focusNode: node,
      // Reachable only in code — tab and arrow traversal should still move
      // between the real fields.
      skipTraversal: true,
      child: const SizedBox.shrink(),
    );
  }
}

/// The way out of a decision, styled so it never competes with the way
/// forward.
///
/// These used to be plain [TextButton]s, which take the theme's primary green —
/// so a sheet asking "send SSP 5,000?" offered a green Send and a green Cancel,
/// two equally weighted greens either side of an irreversible transfer. Cancel
/// is deliberately neutral now: it is always available, never the recommended
/// action, and never the one the eye lands on first.
class CancelButton extends StatelessWidget {
  const CancelButton({super.key, this.label = 'Cancel', this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 48,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          foregroundColor: AppColors.textSecondary,
          textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSizes.radiusControl),
          ),
        ),
        child: Text(label),
      ),
    );
  }
}

/// The same neutral treatment for a dialog's dismiss action, where the buttons
/// sit in a row rather than stacked full width.
ButtonStyle cancelActionStyle() => TextButton.styleFrom(
  foregroundColor: AppColors.textSecondary,
  textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
);

/// A labelled field, drawn the way the design lays them out: a small grey
/// caption above, the control beneath.
class LabelledField extends StatelessWidget {
  const LabelledField({
    super.key,
    required this.label,
    required this.child,
    this.trailingLabel,
  });

  final String label;
  final Widget child;

  /// The right-hand caption on a field that has one — "Forgot PIN?", a balance,
  /// a character count.
  final Widget? trailingLabel;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            if (trailingLabel != null) trailingLabel!,
          ],
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

/// A phone number field, fixed to the `+211` country code the way the design
/// shows it, with an optional contact-picker affordance on the right.
class PhoneField extends StatelessWidget {
  const PhoneField({
    super.key,
    required this.controller,
    this.hint = '+211 9XX XXX XXX',
    this.enabled = true,
    this.onChanged,
    this.validator,
    this.trailing,
    this.focusNode,
  });

  final TextEditingController controller;
  final String hint;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final Widget? trailing;

  /// Owned by the screen, so first-focus happens once rather than every time
  /// this field's element is rebuilt. `autofocus` used to do it, and re-fired
  /// whenever the surrounding list changed shape — see SendMoneyScreen.
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      enabled: enabled,
      focusNode: focusNode,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      onChanged: onChanged,
      validator: validator,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9+ ]')),
        LengthLimitingTextInputFormatter(20),
      ],
      decoration: InputDecoration(hintText: hint, suffixIcon: trailing),
    );
  }
}

/// The large amount entry used by every screen that moves money — the figure is
/// the subject of those screens, so it is set at display size.
class AmountField extends StatelessWidget {
  const AmountField({
    super.key,
    required this.controller,
    this.onChanged,
    this.validator,
    this.autofocus = false,
    this.hint = '0.00',
  });

  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final bool autofocus;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      autofocus: autofocus,
      onChanged: onChanged,
      validator: validator,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textInputAction: TextInputAction.done,
      style: const TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.5,
      ),
      inputFormatters: [
        /* Digits, one point and the separators this adds. The decimal rule
           moved into ThousandsFormatter: a filter that stripped commas would
           have undone the grouping on the very next keystroke. */
        FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
        const ThousandsFormatter(),
      ],
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(
          fontSize: 26,
          fontWeight: FontWeight.w700,
          color: AppColors.textMuted,
        ),
        prefixIcon: const Padding(
          padding: EdgeInsets.only(left: 16, right: 8),
          child: Text(
            'SSP',
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0),
        contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 18),
      ),
    );
  }
}

/// The quick-amount chips — SSP 100 / 200 / 500 / Other in the design.
class AmountChips extends StatelessWidget {
  const AmountChips({
    super.key,
    required this.amounts,
    required this.selected,
    required this.onSelected,
  });

  final List<double> amounts;
  final double? selected;
  final ValueChanged<double?> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: [
        for (final amount in amounts)
          _Chip(
            label: 'SSP ${amount.toStringAsFixed(0)}',
            active: selected == amount,
            onTap: () => onSelected(amount),
          ),
        _Chip(
          label: 'Other',
          active: selected == null,
          onTap: () => onSelected(null),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.active, required this.onTap});

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? AppColors.primaryTint : AppColors.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusControl),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSizes.radiusControl),
            border: Border.all(
              color: active ? AppColors.primary : AppColors.border,
              width: active ? 1.4 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: active ? AppColors.primary : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

/// A tinted strip carrying a message — an error on a form, a warning that an
/// account is suspended, a note that a service is not connected yet.
class Notice extends StatelessWidget {
  const Notice({
    super.key,
    required this.message,
    this.tone = NoticeTone.error,
    this.icon,
    this.action,
  });

  const Notice.info({
    super.key,
    required this.message,
    this.icon = Icons.info_outline_rounded,
    this.action,
  }) : tone = NoticeTone.info;

  const Notice.warning({
    super.key,
    required this.message,
    this.icon = Icons.warning_amber_rounded,
    this.action,
  }) : tone = NoticeTone.warning;

  const Notice.success({
    super.key,
    required this.message,
    this.icon = Icons.check_circle_outline_rounded,
    this.action,
  }) : tone = NoticeTone.success;

  final String message;
  final NoticeTone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final (background, foreground) = switch (tone) {
      NoticeTone.error => (AppColors.dangerTint, AppColors.danger),
      NoticeTone.warning => (AppColors.warningTint, AppColors.warning),
      NoticeTone.success => (AppColors.successTint, AppColors.success),
      NoticeTone.info => (AppColors.infoTint, AppColors.info),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon ?? Icons.error_outline_rounded,
            size: 18,
            color: foreground,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.35,
                fontWeight: FontWeight.w500,
                color: foreground,
              ),
            ),
          ),
          if (action != null) ...[const SizedBox(width: 8), action!],
        ],
      ),
    );
  }
}

enum NoticeTone { error, warning, success, info }

/// A heading with an optional trailing action — "Recent Transactions / See All".
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
              child: Text(
                actionLabel!,
                style: const TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w600,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// What a list shows when it has nothing to show.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.gutter,
          vertical: 40,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: const BoxDecoration(
                color: AppColors.primaryTint,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 28, color: AppColors.primary),
            ),
            const SizedBox(height: 18),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: AppColors.textSecondary,
              ),
            ),
            if (action != null) ...[const SizedBox(height: 20), action!],
          ],
        ),
      ),
    );
  }
}

/// The account picture, falling back to initials on the brand tint.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.initials,
    this.imageProvider,
    this.size = 44,
    this.background = AppColors.primaryTint,
    this.foreground = AppColors.primary,
    this.initialsScale = 0.36,
  });

  final String initials;
  final ImageProvider? imageProvider;
  final double size;
  final Color background;
  final Color foreground;

  /// Initials height as a fraction of the circle. The default suits the large
  /// avatars on a profile; a small one in a toolbar needs proportionally more
  /// or the letters are unreadable at arm's length.
  final double initialsScale;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: background,
        shape: BoxShape.circle,
        image: imageProvider == null
            ? null
            : DecorationImage(image: imageProvider!, fit: BoxFit.cover),
      ),
      alignment: Alignment.center,
      child: imageProvider != null
          ? null
          : Text(
              initials,
              style: TextStyle(
                fontSize: size * initialsScale,
                fontWeight: FontWeight.w700,
                color: foreground,
              ),
            ),
    );
  }
}

/// A row of the profile and settings lists: icon, label, chevron.
class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.trailing,
    this.tone,
    this.subtitle,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;
  final Color? tone;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final color = tone ?? AppColors.textPrimary;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSizes.gutter,
          vertical: 15,
        ),
        child: Row(
          children: [
            Icon(icon, size: 20, color: tone ?? AppColors.textSecondary),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      color: color,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle!,
                      style: const TextStyle(
                        fontSize: 12.5,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            trailing ??
                (onTap == null
                    ? const SizedBox.shrink()
                    : const Icon(
                        Icons.chevron_right_rounded,
                        size: 20,
                        color: AppColors.textMuted,
                      )),
          ],
        ),
      ),
    );
  }
}

/// Feedback for an action that succeeded or failed, in one call.
class AppSnack {
  const AppSnack._();

  static void success(BuildContext context, String message) =>
      _show(context, message, AppColors.success, Icons.check_circle_rounded);

  static void error(BuildContext context, String message) =>
      _show(context, message, AppColors.danger, Icons.error_rounded);

  static void info(BuildContext context, String message) =>
      _show(context, message, AppColors.textPrimary, Icons.info_rounded);

  static void _show(
    BuildContext context,
    String message,
    Color color,
    IconData icon,
  ) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: color,
          duration: const Duration(seconds: 4),
          content: Row(
            children: [
              Icon(icon, size: 18, color: Colors.white),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(color: Colors.white, fontSize: 13.5),
                ),
              ),
            ],
          ),
        ),
      );
  }
}

/// The platform share sheet, behind one call.
///
/// share_plus changed its entry point between major versions; keeping the call
/// in one place means an upgrade is a one-line change rather than a hunt.
class AppShare {
  const AppShare._();

  static Future<void> text(String value) => Share.share(value);
}
