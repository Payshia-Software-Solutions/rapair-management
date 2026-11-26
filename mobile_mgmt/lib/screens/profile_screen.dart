import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/app_lock.dart';
import '../services/session.dart';
import '../services/theme_controller.dart';
import '../theme.dart';
import '../widgets/ui.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _pickLocation(BuildContext context, Session s) async {
    await s.refreshLocations(); // pick up branches added since sign-in
    if (!context.mounted) return;
    final id = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          for (final l in s.locations)
            ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 24),
              leading: IconBadge(
                  Icons.storefront_outlined, Theme.of(ctx).colorScheme.primary,
                  size: 38),
              title: Text(l.name),
              trailing: l.id == s.currentLocation?.id
                  ? Icon(Icons.check_circle_rounded,
                      color: Theme.of(ctx).colorScheme.primary)
                  : null,
              onTap: () => Navigator.pop(ctx, l.id),
            ),
          const SizedBox(height: 12),
        ]),
      ),
    );
    if (id != null) await s.switchLocation(id);
  }

  Future<void> _confirmLogout(BuildContext context, Session s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out?'),
        content:
            const Text('You will stop getting approval alerts on this phone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: AppColors.danger,
                minimumSize: const Size(110, 44)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out'),
          ),
        ],
      ),
    );
    if (ok == true) await s.logout();
  }

  Future<void> _confirmSwitchCompany(BuildContext context, Session s) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Connect a different company?'),
        content: const Text(
            'You will be signed out and the app goes back to Scan QR code.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(120, 44)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (ok == true) await s.switchCompany();
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final api = ApiClient.instance;
    return Scaffold(
      body: ListView(padding: EdgeInsets.zero, children: [
        GradientHeader(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 28),
          child: SizedBox(
            width: double.infinity,
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  InitialsAvatar(s.name ?? '?', size: 84, onGradient: true),
                  const SizedBox(height: 14),
                  Text(s.name ?? '',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.w800)),
                  const SizedBox(height: 4),
                  Text(s.email ?? '',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85))),
                  if ((s.role ?? '').isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(20)),
                      child: Text(s.role!,
                          style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w600,
                              fontSize: 12)),
                    ),
                  ],
                ]),
          ),
        ),
        const SectionTitle('Workspace'),
        _Group(children: [
          _Row(
            icon: Icons.business_rounded,
            color: AppColors.primary,
            title: 'Company',
            value: api.workspaceName ?? api.tenantHost ?? 'Your server',
          ),
          _Row(
            icon: Icons.storefront_rounded,
            color: AppColors.info,
            title: 'Location',
            value: s.currentLocation?.name ?? 'All',
            onTap: s.locations.length > 1 || s.isAdmin
                ? () => _pickLocation(context, s)
                : null,
          ),
        ]),
        const SectionTitle('Appearance'),
        const _ThemePicker(),
        const SectionTitle('Security'),
        const _LockSettings(),
        const SectionTitle('About'),
        _Group(children: [
          FutureBuilder<PackageInfo>(
            future: PackageInfo.fromPlatform(),
            builder: (_, snap) => _Row(
              icon: Icons.info_rounded,
              color: const Color(0xFF6B7280),
              title: 'Version',
              value: snap.hasData
                  ? '${snap.data!.version} (${snap.data!.buildNumber})'
                  : '',
            ),
          ),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: BorderSide(color: AppColors.danger.withValues(alpha: 0.4)),
            ),
            onPressed: () => _confirmLogout(context, s),
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Sign out'),
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          child: TextButton.icon(
            onPressed: () => _confirmSwitchCompany(context, s),
            icon: const Icon(Icons.qr_code_scanner_rounded),
            label: const Text('Connect a different company'),
          ),
        ),
      ]),
    );
  }
}

class _Group extends StatelessWidget {
  final List<Widget> children;
  const _Group({required this.children});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AppCard(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(children: [
            for (final (i, c) in children.indexed) ...[
              if (i > 0) const Divider(indent: 68),
              c,
            ],
          ]),
        ),
      );
}

class _Row extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String? value;
  final Widget? trailing;
  final VoidCallback? onTap;
  const _Row(
      {required this.icon,
      required this.color,
      required this.title,
      this.value,
      this.trailing,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return ListTile(
      onTap: onTap,
      leading: IconBadge(icon, color, size: 38),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: value != null && trailing != null ? Text(value!) : null,
      trailing: trailing ??
          Row(mainAxisSize: MainAxisSize.min, children: [
            if (value != null)
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 150),
                child: Text(value!,
                    overflow: TextOverflow.ellipsis,
                    style: t.textTheme.bodyMedium
                        ?.copyWith(color: t.colorScheme.onSurfaceVariant)),
              ),
            if (onTap != null)
              Icon(Icons.chevron_right_rounded, color: t.colorScheme.outline),
          ]),
    );
  }
}

class _LockSettings extends StatelessWidget {
  const _LockSettings();

  static String _label(int m) => m == 0 ? 'Immediately' : 'After $m min';

  @override
  Widget build(BuildContext context) {
    final lock = context.watch<AppLock>();
    if (!lock.supported) {
      return const _Group(children: [
        _Row(
            icon: Icons.lock_rounded,
            color: Color(0xFF6B7280),
            title: 'App lock',
            value: 'Set a phone screen lock first'),
      ]);
    }
    return _Group(children: [
      _Row(
        icon: Icons.fingerprint_rounded,
        color: AppColors.success,
        title: 'App lock',
        value: 'Fingerprint, face or phone PIN',
        trailing: Switch(
          value: lock.enabled,
          onChanged: (v) async {
            final ok = await lock.setEnabled(v);
            if (!ok && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                  content: Text('Could not confirm. App lock is still off.')));
            }
          },
        ),
      ),
      if (lock.enabled)
        _Row(
          icon: Icons.timer_rounded,
          color: AppColors.warning,
          title: 'Lock',
          value: _label(lock.timeoutMinutes),
          onTap: () async {
            final m = await showModalBottomSheet<int>(
              context: context,
              showDragHandle: true,
              builder: (ctx) => SafeArea(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (final c in AppLock.timeoutChoices)
                    ListTile(
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 24),
                      title: Text(c == 0 ? 'Immediately' : 'After $c min away'),
                      trailing: c == lock.timeoutMinutes
                          ? Icon(Icons.check_circle_rounded,
                              color: Theme.of(ctx).colorScheme.primary)
                          : null,
                      onTap: () => Navigator.pop(ctx, c),
                    ),
                  const SizedBox(height: 12),
                ]),
              ),
            );
            if (m != null) await lock.setTimeout(m);
          },
        ),
    ]);
  }
}

class _ThemePicker extends StatelessWidget {
  const _ThemePicker();

  @override
  Widget build(BuildContext context) {
    final tc = context.watch<ThemeController>();
    final t = Theme.of(context);
    Widget opt(ThemeMode m, IconData icon, String label) {
      final sel = tc.mode == m;
      return Expanded(
        child: GestureDetector(
          onTap: () => tc.set(m),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: sel ? t.colorScheme.primary : Colors.transparent,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(children: [
              Icon(icon,
                  color: sel ? Colors.white : t.colorScheme.onSurfaceVariant),
              const SizedBox(height: 4),
              Text(label,
                  style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                      color:
                          sel ? Colors.white : t.colorScheme.onSurfaceVariant)),
            ]),
          ),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: AppCard(
        padding: const EdgeInsets.all(6),
        child: Row(children: [
          opt(ThemeMode.light, Icons.light_mode_rounded, 'Light'),
          opt(ThemeMode.dark, Icons.dark_mode_rounded, 'Dark'),
          opt(ThemeMode.system, Icons.phone_android_rounded, 'Phone'),
        ]),
      ),
    );
  }
}
