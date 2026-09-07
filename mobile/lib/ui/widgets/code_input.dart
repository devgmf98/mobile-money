import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';

/// A fixed-length code entered on the system keyboard, drawn as separate boxes.
///
/// One real text field sits invisibly behind the boxes rather than one field
/// per digit: the OS autofills an SMS code into a single field, paste works,
/// and backspace crosses a boundary without the focus juggling that per-digit
/// fields need.
class CodeInput extends StatefulWidget {
  const CodeInput({
    super.key,
    required this.controller,
    this.length = 6,
    this.autofocus = true,
    this.onCompleted,
  });

  final TextEditingController controller;
  final int length;
  final bool autofocus;
  final ValueChanged<String>? onCompleted;

  @override
  State<CodeInput> createState() => _CodeInputState();
}

class _CodeInputState extends State<CodeInput> {
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    _focus.dispose();
    super.dispose();
  }

  void _onChanged() {
    setState(() {});
    if (widget.controller.text.length == widget.length) {
      widget.onCompleted?.call(widget.controller.text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final value = widget.controller.text;

    return Stack(
      children: [
        // The field itself: sized to the boxes so taps anywhere on them focus
        // it, but painted transparent.
        Opacity(
          opacity: 0,
          child: TextField(
            controller: widget.controller,
            focusNode: _focus,
            autofocus: widget.autofocus,
            keyboardType: TextInputType.number,
            enableInteractiveSelection: false,
            autofillHints: const [AutofillHints.oneTimeCode],
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(widget.length),
            ],
            decoration: const InputDecoration(
              contentPadding: EdgeInsets.symmetric(vertical: 26),
            ),
          ),
        ),
        Positioned.fill(
          child: GestureDetector(
            onTap: () => _focus.requestFocus(),
            behavior: HitTestBehavior.opaque,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                for (var index = 0; index < widget.length; index++)
                  _Box(
                    character: index < value.length ? value[index] : null,
                    active: _focus.hasFocus && index == value.length,
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Box extends StatelessWidget {
  const _Box({required this.character, required this.active});

  final String? character;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final filled = character != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      width: 46,
      height: 54,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: filled ? AppColors.primaryTint : AppColors.field,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        border: Border.all(
          color: active
              ? AppColors.primary
              : filled
              ? AppColors.primary.withValues(alpha: 0.35)
              : AppColors.border,
          width: active ? 1.6 : 1,
        ),
      ),
      child: Text(
        character ?? '',
        style: const TextStyle(
          fontSize: 21,
          fontWeight: FontWeight.w700,
          color: AppColors.primary,
        ),
      ),
    );
  }
}

/// The on-screen numeric keypad from the security screen.
///
/// A PIN gets its own pad rather than the system keyboard: it is four digits
/// entered one-handed, often in a hurry, and the pad puts them under the thumb.
class PinPad extends StatelessWidget {
  const PinPad({
    super.key,
    required this.length,
    required this.value,
    required this.onChanged,
    this.error = false,
  });

  final int length;
  final String value;
  final ValueChanged<String> onChanged;

  /// Shakes and reddens the dots on a wrong code.
  final bool error;

  void _press(String digit) {
    if (value.length >= length) return;
    onChanged(value + digit);
  }

  void _backspace() {
    if (value.isEmpty) return;
    onChanged(value.substring(0, value.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var index = 0; index < length; index++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 9),
                child: _Dot(filled: index < value.length, error: error),
              ),
          ],
        ),
        const SizedBox(height: 40),
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['', '0', '<'],
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (final key in row)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: switch (key) {
                      '' => const SizedBox(width: 74, height: 58),
                      '<' => _Key(
                        onTap: _backspace,
                        child: const Icon(
                          Icons.backspace_outlined,
                          size: 20,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      _ => _Key(
                        onTap: () => _press(key),
                        child: Text(
                          key,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    },
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.filled, required this.error});

  final bool filled;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color = error ? AppColors.danger : AppColors.primary;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 15,
      height: 15,
      decoration: BoxDecoration(
        color: filled ? color : Colors.transparent,
        shape: BoxShape.circle,
        border: Border.all(
          color: filled ? color : AppColors.border,
          width: 1.5,
        ),
      ),
    );
  }
}

class _Key extends StatelessWidget {
  const _Key({required this.onTap, required this.child});

  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      borderRadius: BorderRadius.circular(AppSizes.radiusControl),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppSizes.radiusControl),
        child: Container(
          width: 74,
          height: 58,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSizes.radiusControl),
            border: Border.all(color: AppColors.border),
          ),
          child: child,
        ),
      ),
    );
  }
}
