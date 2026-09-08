import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/phone.dart';
import '../../../state/auth_controller.dart';
import '../../widgets/brand.dart';
import '../../widgets/controls.dart';
import '../../widgets/brand_app_bar.dart';

/// Your QR code, for someone else to scan and pay.
///
/// The payload is the exact JSON shape the web app writes — the same three
/// phone keys and the `payment` type — so a code shown here scans in the web
/// app and vice versa. Changing it would quietly split the two.
class ReceiveQrScreen extends StatelessWidget {
  const ReceiveQrScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthController>().user;

    if (user == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final phone = Phone.normalise(user.phone);
    final payload = jsonEncode({
      'phone': phone,
      'recipient': phone,
      'phoneNumber': phone,
      'name': user.name,
      'type': 'payment',
    });

    return Scaffold(
      appBar: const BrandAppBar(),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSizes.gutter,
            8,
            AppSizes.gutter,
            28,
          ),
          children: [
            // No balance here, deliberately. This is the one screen made to be
            // turned around and held out for someone else to scan, so it must
            // carry only what the payer needs — the code, the name and the
            // number they are paying.
            const SizedBox(height: 8),

            Center(
              child: Container(
                padding: const EdgeInsets.fromLTRB(22, 20, 22, 22),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const BrandMark(size: 22),
                        const SizedBox(width: 7),
                        Text(
                          'MoneyPay',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),
                    QrImageView(
                      data: payload,
                      size: 216,
                      version: QrVersions.auto,
                      backgroundColor: Colors.white,
                      eyeStyle: const QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: AppColors.textPrimary,
                      ),
                      dataModuleStyle: const QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      user.name,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      Phone.pretty(user.phone),
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 20),
            const Center(
              child: Text(
                'Scan to pay',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 4),
            const Center(
              child: Text(
                'Share your QR code to receive money',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
            ),

            const SizedBox(height: 26),
            PrimaryButton(
              label: 'Share My Number',
              icon: Icons.ios_share_rounded,
              onPressed: () => AppShare.text(
                'Send me money on MoneyPay.\n'
                '${user.name} — ${Phone.pretty(user.phone)}',
              ),
            ),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: phone));
                AppSnack.info(context, 'Your number was copied');
              },
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: const Text('Copy Number'),
            ),
          ],
        ),
      ),
    );
  }
}
