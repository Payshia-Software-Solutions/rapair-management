import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/app_lock.dart';
import '../services/session.dart';
import '../theme.dart';
import '../widgets/ui.dart';

class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => AppLock.instance.unlock());
  }

  @override
  Widget build(BuildContext context) {
    final s = context.read<Session>();
    return Scaffold(
      body: Container(
        width: double.infinity,
        decoration: const BoxDecoration(gradient: AppColors.headerGradient),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(children: [
              const Spacer(),
              InitialsAvatar(s.name ?? '?', size: 88, onGradient: true),
              const SizedBox(height: 18),
              Text(s.name ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
              const SizedBox(height: 6),
              Text('BizzFlow is locked', style: TextStyle(color: Colors.white.withValues(alpha: 0.8))),
              const Spacer(),
              Material(
                color: Colors.white,
                shape: const CircleBorder(),
                child: InkWell(
                  customBorder: const CircleBorder(),
                  onTap: AppLock.instance.unlock,
                  child: const Padding(
                    padding: EdgeInsets.all(22),
                    child: Icon(Icons.fingerprint_rounded, size: 48, color: AppColors.primary),
                  ),
                ),
              ),
              const SizedBox(height: 14),
              const Text('Tap to unlock', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              const SizedBox(height: 32),
              TextButton(
                style: TextButton.styleFrom(foregroundColor: Colors.white70),
                onPressed: () async {
                  await s.logout();
                  AppLock.instance.reset();
                },
                child: const Text('Sign out instead'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
