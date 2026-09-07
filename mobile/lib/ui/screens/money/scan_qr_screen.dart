import 'dart:convert';

import 'package:flutter/material.dart';
// mobile_scanner exports its own `Phone` (a parsed contact barcode field),
// which would shadow the phone-number helper this screen actually needs.
import 'package:mobile_scanner/mobile_scanner.dart' hide Phone;

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/phone.dart';
import '../../../routing/routes.dart';
import '../../widgets/controls.dart';

/// Scan someone's MoneyPay code to pay them.
///
/// Two payload shapes are accepted: the JSON the app and the web app both
/// write, and a bare phone number — printed codes in the wild are often just
/// the number, and refusing those would make the scanner look broken.
class ScanQrScreen extends StatefulWidget {
  const ScanQrScreen({super.key});

  @override
  State<ScanQrScreen> createState() => _ScanQrScreenState();
}

class _ScanQrScreenState extends State<ScanQrScreen> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );

  bool _handled = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Pulls a phone number out of whatever the code carried.
  String? _readPhone(String raw) {
    final text = raw.trim();
    if (text.isEmpty) return null;

    if (text.startsWith('{')) {
      try {
        final decoded = jsonDecode(text);
        if (decoded is Map) {
          for (final key in const ['phoneNumber', 'phone', 'recipient']) {
            final value = decoded[key]?.toString();
            if (value != null && Phone.looksValid(value)) return value;
          }
        }
      } catch (_) {
        // Not JSON after all — fall through and try it as a bare number.
      }
      return null;
    }

    return Phone.looksValid(text) ? text : null;
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;

    for (final barcode in capture.barcodes) {
      final phone = _readPhone(barcode.rawValue ?? '');
      if (phone == null) continue;

      _handled = true;
      _controller.stop();
      Navigator.of(context).pushReplacementNamed(
        Routes.sendMoney,
        arguments: Phone.normalise(phone),
      );
      return;
    }

    // Reached only when a code scanned but held nothing usable — worth saying,
    // because the alternative is a scanner that appears to ignore the code.
    if (mounted && capture.barcodes.isNotEmpty) {
      setState(() => _error = 'That code is not a MoneyPay payment code.');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Scan to Pay'),
        titleTextStyle: const TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        leading: const BackButton(color: Colors.white),
        actions: [
          IconButton(
            onPressed: () => _controller.toggleTorch(),
            icon: const Icon(Icons.flashlight_on_rounded),
            tooltip: 'Torch',
          ),
        ],
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error, _) => _CameraProblem(error: error),
          ),

          // The cut-out that tells people where to aim.
          const _ScanWindow(),

          Align(
            alignment: Alignment.bottomCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSizes.gutter),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_error != null) ...[
                      Notice.warning(message: _error!),
                      const SizedBox(height: 14),
                    ],
                    const Text(
                      'Point the camera at a MoneyPay QR code',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 13.5, color: Colors.white70),
                    ),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(
                        context,
                      ).pushReplacementNamed(Routes.sendMoney),
                      icon: const Icon(Icons.dialpad_rounded, size: 18),
                      label: const Text('Enter number instead'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.white,
                        side: const BorderSide(color: Colors.white38),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScanWindow extends StatelessWidget {
  const _ScanWindow();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Center(
        child: Container(
          width: 250,
          height: 250,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.white, width: 2.5),
            borderRadius: BorderRadius.circular(24),
          ),
        ),
      ),
    );
  }
}

/// Shown when the camera cannot be used at all — most often a denied
/// permission, which needs a route out rather than a black rectangle.
class _CameraProblem extends StatelessWidget {
  const _CameraProblem({required this.error});

  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;

    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSizes.gutter + 8),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.no_photography_outlined,
                size: 44,
                color: Colors.white54,
              ),
              const SizedBox(height: 18),
              Text(
                denied ? 'Camera access is off' : 'The camera is unavailable',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                denied
                    ? 'Allow camera access in your phone settings to scan '
                          'payment codes, or type the number instead.'
                    : 'You can still pay by typing the number.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.5,
                  color: Colors.white70,
                ),
              ),
              const SizedBox(height: 22),
              FilledButton(
                onPressed: () => Navigator.of(
                  context,
                ).pushReplacementNamed(Routes.sendMoney),
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size(220, 48),
                ),
                child: const Text('Enter number instead'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
