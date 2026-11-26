import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Parsed bizzflow://connect?api=...&host=... (made by front-end/src/components/mobile-connect-card.tsx).
class QrConnect {
  final String api;
  final String? host;
  const QrConnect(this.api, this.host);

  static QrConnect? parse(String raw) {
    final u = Uri.tryParse(raw.trim());
    if (u == null || u.scheme != 'bizzflow' || u.host != 'connect') return null;
    final api = u.queryParameters['api'];
    if (api == null || !(api.startsWith('http://') || api.startsWith('https://'))) return null;
    final host = u.queryParameters['host'];
    return QrConnect(api, (host == null || host.isEmpty) ? null : host);
  }
}

class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  bool _done = false;
  String? _hint;

  void _onDetect(BarcodeCapture cap) {
    if (_done) return;
    for (final b in cap.barcodes) {
      final raw = b.rawValue;
      if (raw == null) continue;
      final c = QrConnect.parse(raw);
      if (c != null) {
        _done = true;
        Navigator.pop(context, c);
        return;
      }
      setState(() => _hint = 'That is not a BizzFlow code. Use the one on the website: Profile › Connect mobile app.');
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    const box = 260.0;
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        foregroundColor: Colors.white,
        title: const Text('Scan QR code', style: TextStyle(color: Colors.white)),
        actions: [
          IconButton(icon: const Icon(Icons.flash_on_rounded), onPressed: _controller.toggleTorch),
        ],
      ),
      body: Stack(children: [
        MobileScanner(
          controller: _controller,
          onDetect: _onDetect,
          errorBuilder: (context, error) => Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                error.errorCode == MobileScannerErrorCode.permissionDenied
                    ? 'Camera permission is off. Allow it in Settings › Apps › BizzFlow Mgmt › Permissions.'
                    : 'Camera could not start.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
            ),
          ),
        ),
        // Dimmed surround with a clear square
        ColorFiltered(
          colorFilter: ColorFilter.mode(Colors.black.withValues(alpha: 0.55), BlendMode.srcOut),
          child: Stack(children: [
            Container(decoration: const BoxDecoration(color: Colors.transparent, backgroundBlendMode: BlendMode.dstOut)),
            Center(
              child: Container(
                width: box,
                height: box,
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28)),
              ),
            ),
          ]),
        ),
        Center(
          child: Container(
            width: box,
            height: box,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.white, width: 3),
              borderRadius: BorderRadius.circular(28),
            ),
          ),
        ),
        Positioned(
          left: 24,
          right: 24,
          bottom: 60,
          child: Column(children: [
            const Text('Point at the QR code on the BizzFlow website',
                textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            Text(_hint ?? 'Website: Profile › Connect mobile app',
                textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withValues(alpha: 0.75))),
          ]),
        ),
      ]),
    );
  }
}
