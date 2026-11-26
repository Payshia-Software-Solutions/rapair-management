import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/approval_service.dart';
import '../services/push_service.dart';
import '../services/session.dart';
import 'approvals/approval_detail_screen.dart';
import 'approvals/approvals_screen.dart';
import 'dashboard/dashboard_screen.dart';
import 'profile_screen.dart';

/// Bottom-nav shell: Dashboard (if permitted), Approvals (with inbox badge), Profile.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  int _tab = 0;
  StreamSubscription? _tapSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ApprovalService.instance.refreshCount();
    _tapSub = PushService.instance.taps.stream.listen(_openFromPush);
    final first = PushService.instance.initialTap;
    if (first != null) {
      PushService.instance.initialTap = null;
      WidgetsBinding.instance.addPostFrameCallback((_) => _openFromPush(first));
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tapSub?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) ApprovalService.instance.refreshCount();
  }

  /// Push tap: switch to Approvals and open that request.
  Future<void> _openFromPush(Map<String, dynamic> data) async {
    final type = '${data['type'] ?? ''}';
    if (type == 'cancellation') {
      _goTo('approvals');
      final cid = int.tryParse('${data['cancellation_id'] ?? ''}');
      List<ApprovalItem> list;
      try {
        list = await ApprovalService.instance.inbox();
      } catch (_) {
        return;
      }
      final item = list.where((i) => i.isCancellation && i.id == cid).firstOrNull;
      if (item != null && mounted) {
        Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => ApprovalDetailScreen(requestId: item.id, cancellation: item)));
      }
      return;
    }
    if (!type.startsWith('approval')) return;
    final i = _tabs(context.read<Session>()).indexWhere((t) => t.key == 'approvals');
    if (i >= 0) setState(() => _tab = i);
    final id = int.tryParse('${data['request_id'] ?? ''}');
    if (id != null) {
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => ApprovalDetailScreen(requestId: id)));
    }
    ApprovalService.instance.refreshCount();
  }

  void _goTo(String key) {
    final i = _tabs(context.read<Session>()).indexWhere((t) => t.key == key);
    if (i >= 0) setState(() => _tab = i);
  }

  List<_Tab> _tabs(Session s) => [
        if (s.canSeeDashboards || s.canSeeOperations)
          _Tab('dashboard', 'Home', Icons.space_dashboard_outlined, Icons.space_dashboard_rounded,
              DashboardScreen(onOpenApprovals: () => _goTo('approvals'))),
        const _Tab('approvals', 'Approvals', Icons.fact_check_outlined, Icons.fact_check_rounded, ApprovalsScreen()),
        const _Tab('profile', 'Profile', Icons.person_outline_rounded, Icons.person_rounded, ProfileScreen()),
      ];

  @override
  Widget build(BuildContext context) {
    final tabs = _tabs(context.watch<Session>());
    final i = _tab.clamp(0, tabs.length - 1);
    return Scaffold(
      body: IndexedStack(index: i, children: tabs.map((t) => t.body).toList()),
      bottomNavigationBar: ListenableBuilder(
        listenable: ApprovalService.instance,
        builder: (context, _) {
          final count = ApprovalService.instance.inboxCount;
          return NavigationBar(
            selectedIndex: i,
            onDestinationSelected: (v) => setState(() => _tab = v),
            destinations: [
              for (final t in tabs)
                NavigationDestination(
                  icon: _badge(t, count, Icon(t.icon)),
                  selectedIcon: _badge(t, count, Icon(t.selectedIcon)),
                  label: t.label,
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _badge(_Tab t, int count, Widget icon) =>
      t.key == 'approvals' && count > 0 ? Badge(label: Text(count > 99 ? '99+' : '$count'), child: icon) : icon;
}

class _Tab {
  final String key;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final Widget body;
  const _Tab(this.key, this.label, this.icon, this.selectedIcon, this.body);
}
