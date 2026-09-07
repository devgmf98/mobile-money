import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// A yes/no question, laid out properly.
///
/// [AlertDialog]'s own actions row does not survive this app's theme: every
/// FilledButton carries `minimumSize: Size.fromHeight(52)` so that the primary
/// button on a form fills its width, and inside a dialog that turns the
/// confirming action into a full-width slab with the cancel stranded above it.
/// Laying the two out here keeps the theme honest for forms while giving a
/// dialog the balanced pair it should have.
Future<bool?> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
  IconData? icon,

  /// Colours the confirming action. Red for anything that destroys or cannot
  /// be undone; the brand green otherwise.
  bool destructive = false,
}) {
  final accent = destructive ? AppColors.danger : AppColors.primary;

  return showDialog<bool>(
    context: context,
    builder: (dialogContext) => Dialog(
      insetPadding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
      backgroundColor: AppColors.surface,
      // Rounder than the theme's default. A dialog is a card that arrived
      // rather than one that was always there, and the softer corner is what
      // says so.
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (icon != null) ...[
              // Centred and circular, with a wash ring around it. Square in
              // the top-left corner, it read as a stray list icon that had
              // wandered into a dialog rather than as the subject of one.
              Center(
                child: Container(
                  width: 66,
                  height: 66,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: accent.withValues(alpha: 0.14),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(icon, size: 24, color: accent),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 18),
            ],

            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18.5,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 9),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 13.5,
                height: 1.55,
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 24),

            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(false),
                      style: TextButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        backgroundColor: AppColors.surface,
                        textStyle: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                          // An outline rather than a wash: on a white dialog
                          // the tinted fill barely registered, so the pair read
                          // as one button beside a gap.
                          side: const BorderSide(color: AppColors.border),
                        ),
                      ),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(cancelLabel, maxLines: 1),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SizedBox(
                    height: 50,
                    child: FilledButton(
                      onPressed: () => Navigator.of(dialogContext).pop(true),
                      style: FilledButton.styleFrom(
                        backgroundColor: accent,
                        // Overrides the theme's form-button height, which is
                        // what broke this layout in the first place.
                        minimumSize: const Size(0, 50),
                        elevation: 0,
                        textStyle: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      // scaleDown, so an ordinary label is untouched and only
                      // one that would not otherwise fit gives up any size --
                      // a single line either way.
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(confirmLabel, maxLines: 1),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
