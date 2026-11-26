import 'package:flutter/material.dart';

import '../services/api_client.dart';
import '../theme.dart';
import 'qr_scan_screen.dart';

/// First run: connect by scanning the QR code on the BizzFlow website
/// (Profile > Connect mobile app, front-end/src/components/mobile-connect-card.tsx).
/// The code carries the API address and workspace, so users never type a server address.
class SetupScreen extends StatefulWidget {
  final VoidCallback onSaved;
  const SetupScreen({super.key, required this.onSaved});

  @override
  State<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends State<SetupScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _scan() async {
    final res = await Navigator.push<QrConnect>(context, MaterialPageRoute(builder: (_) => const QrScanScreen()));
    if (res == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final c = ApiClient.instance;
    try {
      await c.saveServer(res.api, res.host);
      final name = await c.verifyConnection();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Connected to $name')));
      widget.onSaved();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Container(
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: SafeArea(
          bottom: false,
          child: LayoutBuilder(
            builder: (context, box) => SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: box.maxHeight),
                child: IntrinsicHeight(
                  child: Column(children: [
                    const SizedBox(height: 40),
                    const _Logo(),
                    const SizedBox(height: 20),
                    const Text('BizzFlow Manager',
                        style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text('Dashboards and approvals in your pocket',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 14)),
                    const SizedBox(height: 40),
                    Expanded(
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
                        decoration: BoxDecoration(
                          color: t.scaffoldBackgroundColor,
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(32)),
                        ),
                        child: SafeArea(
                          top: false,
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            Text('Connect your company', style: t.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                            const SizedBox(height: 4),
                            Text('Scan the QR code from the BizzFlow website. It takes a few seconds.',
                                style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                            const SizedBox(height: 22),
                            const _Step(n: 1, icon: Icons.computer_rounded, title: 'Open BizzFlow on a computer', sub: 'Sign in with your account'),
                            const _Step(n: 2, icon: Icons.person_rounded, title: 'Go to your Profile', sub: 'Click your name, then Profile'),
                            const _Step(
                                n: 3, icon: Icons.qr_code_2_rounded, title: 'Find "Connect mobile app"', sub: 'A QR code is shown there', last: true),
                            const SizedBox(height: 22),
                            if (_error != null) ...[
                              _ErrorBox(_error!),
                              const SizedBox(height: 14),
                            ],
                            const Spacer(),
                            _ScanButton(busy: _busy, onTap: _busy ? null : _scan),
                          ]),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Step extends StatelessWidget {
  final int n;
  final IconData icon;
  final String title, sub;
  final bool last;
  const _Step({required this.n, required this.icon, required this.title, required this.sub, this.last = false});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final c = t.colorScheme.primary;
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          Container(
            width: 32,
            height: 32,
            alignment: Alignment.center,
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppColors.headerGradient),
            child: Text('$n', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
          ),
          if (!last) Expanded(child: Container(width: 2, margin: const EdgeInsets.symmetric(vertical: 4), color: c.withValues(alpha: 0.15))),
        ]),
        const SizedBox(width: 14),
        Expanded(
          child: Padding(
            padding: EdgeInsets.only(bottom: last ? 0 : 18, top: 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 2),
              Text(sub, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
            ]),
          ),
        ),
        Icon(icon, color: c.withValues(alpha: 0.5)),
      ]),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();
  @override
  Widget build(BuildContext context) => Container(
        width: 84,
        height: 84,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.18), blurRadius: 30, offset: const Offset(0, 12))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Image.asset('assets/branding/splash_brand.png', fit: BoxFit.cover),
      );
}

class _ScanButton extends StatelessWidget {
  final bool busy;
  final VoidCallback? onTap;
  const _ScanButton({required this.busy, required this.onTap});
  @override
  Widget build(BuildContext context) => Material(
        borderRadius: BorderRadius.circular(18),
        clipBehavior: Clip.antiAlias,
        child: Ink(
          decoration: const BoxDecoration(gradient: AppColors.headerGradient),
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 18, horizontal: 20),
              child: Row(children: [
                busy
                    ? const SizedBox(width: 30, height: 30, child: CircularProgressIndicator(strokeWidth: 2.6, color: Colors.white))
                    : const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 30),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(busy ? 'Connecting…' : 'Scan QR code',
                        style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 2),
                    Text(busy ? 'Checking your company' : 'Opens the camera',
                        style: const TextStyle(color: Colors.white70, fontSize: 13)),
                  ]),
                ),
                if (!busy) const Icon(Icons.arrow_forward_rounded, color: Colors.white),
              ]),
            ),
          ),
        ),
      );
}

class _ErrorBox extends StatelessWidget {
  final String text;
  const _ErrorBox(this.text);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          const Icon(Icons.error_outline, color: AppColors.danger, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Text(text, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w500))),
        ]),
      );
}
