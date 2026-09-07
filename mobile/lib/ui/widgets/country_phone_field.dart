import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/countries.dart';

/// A phone field with the dialling code chosen rather than assumed.
///
/// Everywhere else in the app a number is a South Sudanese one — you send to
/// another MoneyPay account, and those are +211. Sign-up is the exception: the
/// person creating the account may be reachable on a Ugandan or Emirati number,
/// and the verification SMS has to go to whichever it actually is.
class CountryPhoneField extends StatelessWidget {
  const CountryPhoneField({
    super.key,
    required this.controller,
    required this.country,
    required this.onCountryChanged,
    this.onChanged,
    this.validator,
    this.hint = '9XX XXX XXX',
  });

  /// Holds the local part only — the dial code is [country].
  final TextEditingController controller;
  final Country country;
  final ValueChanged<Country> onCountryChanged;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: TextInputType.phone,
      textInputAction: TextInputAction.next,
      onChanged: onChanged,
      validator: validator,
      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500),
      inputFormatters: [
        FilteringTextInputFormatter.allow(RegExp(r'[0-9 ]')),
        LengthLimitingTextInputFormatter(15),
      ],
      decoration: InputDecoration(
        hintText: hint,
        prefixIcon: _CodeButton(
          country: country,
          onTap: () async {
            final picked = await showCountryPicker(context, country);
            if (picked != null) onCountryChanged(picked);
          },
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0),
      ),
    );
  }
}

class _CodeButton extends StatelessWidget {
  const _CodeButton({required this.country, required this.onTap});

  final Country country;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: const BorderRadius.horizontal(
        left: Radius.circular(AppSizes.radiusControl),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 10, 14),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              country.dial,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(width: 3),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 18,
              color: AppColors.textSecondary,
            ),
            const SizedBox(width: 8),
            Container(width: 1, height: 22, color: AppColors.border),
          ],
        ),
      ),
    );
  }
}

/// The country list, searchable by name, code or dialling prefix.
Future<Country?> showCountryPicker(BuildContext context, Country selected) {
  return showModalBottomSheet<Country>(
    context: context,
    // The root navigator, not the shell's nested one. Without this the
    // sheet is mounted inside the shell body, so it stops at the bottom
    // bar - the barrier leaves the bar live and the sheet is clipped
    // short of the screen edge.
    useRootNavigator: true,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CountryPickerSheet(selected: selected),
  );
}

class _CountryPickerSheet extends StatefulWidget {
  const _CountryPickerSheet({required this.selected});

  final Country selected;

  @override
  State<_CountryPickerSheet> createState() => _CountryPickerSheetState();
}

class _CountryPickerSheetState extends State<_CountryPickerSheet> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visible = Countries.all
        .where((country) => country.matches(_search.text))
        .toList(growable: false);

    return SafeArea(
      child: SizedBox(
        // Tall enough to browse, short enough that the field behind it stays
        // in view.
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSizes.gutter,
                0,
                AppSizes.gutter,
                12,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Country code',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _search,
                    autofocus: false,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      hintText: 'Search country or code',
                      prefixIcon: Icon(Icons.search_rounded, size: 19),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: visible.isEmpty
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text(
                          'No country matched that.',
                          style: TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: visible.length,
                      itemBuilder: (context, index) {
                        final country = visible[index];
                        final isSelected = country.code == widget.selected.code;

                        return ListTile(
                          onTap: () => Navigator.of(context).pop(country),
                          // Android often has no flag glyphs, in which case
                          // the regional indicators render as the two-letter
                          // code - which is still worth showing.
                          leading: Text(
                            country.flag,
                            style: const TextStyle(fontSize: 22),
                          ),
                          title: Text(
                            country.name,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: isSelected
                                  ? FontWeight.w700
                                  : FontWeight.w500,
                              color: isSelected
                                  ? AppColors.primaryDark
                                  : AppColors.textPrimary,
                            ),
                          ),
                          trailing: Text(
                            country.dial,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? AppColors.primaryDark
                                  : AppColors.textSecondary,
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
