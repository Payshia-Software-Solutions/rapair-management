import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/approval_service.dart';
import '../../theme.dart';
import '../../widgets/format.dart';
import '../../widgets/ui.dart';
import 'approval_detail_screen.dart';

/// Gradient header with the waiting count, a segmented switch, and request cards.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key});

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> {
  bool _mine = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(children: [
        GradientHeader(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Approvals', style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 4),
            ListenableBuilder(
              listenable: ApprovalService.instance,
              builder: (_, __) {
                final n = ApprovalService.instance.inboxCount;
                return Text(n == 0 ? 'You are all caught up' : '$n waiting for your decision',
                    style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 14));
              },
            ),
            const SizedBox(height: 18),
            _Segmented(
              mine: _mine,
              onChanged: (v) => setState(() => _mine = v),
            ),
          ]),
        ),
        Expanded(
          child: IndexedStack(index: _mine ? 1 : 0, children: const [_List(mine: false), _List(mine: true)]),
        ),
      ]),
    );
  }
}

class _Segmented extends StatelessWidget {
  final bool mine;
  final ValueChanged<bool> onChanged;
  const _Segmented({required this.mine, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    Widget seg(String label, bool value) {
      final sel = mine == value;
      return Expanded(
        child: GestureDetector(
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: sel ? Colors.white : Colors.transparent,
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(label,
                style: TextStyle(fontWeight: FontWeight.w700, color: sel ? AppColors.primary : Colors.white)),
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(16)),
      child: Row(children: [seg('To approve', false), seg('My requests', true)]),
    );
  }
}

class _List extends StatefulWidget {
  final bool mine;
  const _List({required this.mine});

  @override
  State<_List> createState() => _ListState();
}

class _ListState extends State<_List> {
  final _svc = ApprovalService.instance;
  List<ApprovalItem>? _items;
  String? _error;
  String? _typeFilter;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
    // Inbox reloads when a push arrives or someone acts elsewhere.
    if (!widget.mine) _svc.addListener(_onCountChanged);
  }

  @override
  void dispose() {
    _svc.removeListener(_onCountChanged);
    super.dispose();
  }

  // inbox() sets the count to the list length, so this only fires on a real change.
  void _onCountChanged() {
    final items = _items;
    if (items != null && items.length != _svc.inboxCount) _load();
  }

  Future<void> _load() async {
    try {
      final list = widget.mine ? await _svc.mine() : await _svc.inbox();
      if (mounted) {
        setState(() {
          _items = list;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _open(ApprovalItem it) async {
    final changed = await Navigator.push<bool>(
        context,
        MaterialPageRoute(
            builder: (_) => ApprovalDetailScreen(requestId: it.id, cancellation: it.isCancellation ? it : null)));
    if (changed == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (items == null) {
      return _error != null
          ? EmptyState(icon: Icons.cloud_off_rounded, title: 'Could not load', message: _error, action: 'Try again', onAction: _load)
          : const Center(child: CircularProgressIndicator());
    }
    final types = {for (final i in items) i.docType: i.docTypeLabel};
    final q = _query.toLowerCase();
    final shown = items.where((i) {
      if (_typeFilter != null && i.docType != _typeFilter) return false;
      if (q.isEmpty) return true;
      return [i.docNo, i.summary, i.requestedBy, i.docTypeLabel].any((s) => (s ?? '').toLowerCase().contains(q));
    }).toList();

    return RefreshIndicator(
      onRefresh: _load,
      child: CustomScrollView(physics: const AlwaysScrollableScrollPhysics(), slivers: [
        if (items.length > 3)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: TextField(
                decoration: const InputDecoration(
                  hintText: 'Search number, person or details',
                  prefixIcon: Icon(Icons.search_rounded),
                ),
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
          ),
        if (types.length > 1)
          SliverToBoxAdapter(
            child: SizedBox(
              height: 56,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                children: [
                  _FilterChip(label: 'All', selected: _typeFilter == null, onTap: () => setState(() => _typeFilter = null)),
                  for (final e in types.entries)
                    _FilterChip(label: e.value, selected: _typeFilter == e.key, onTap: () => setState(() => _typeFilter = e.key)),
                ],
              ),
            ),
          ),
        if (shown.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: items.isEmpty
                ? EmptyState(
                    icon: widget.mine ? Icons.outbox_rounded : Icons.celebration_rounded,
                    title: widget.mine ? 'No requests yet' : 'All caught up!',
                    message: widget.mine ? 'Requests you send for approval show up here.' : 'Nothing is waiting for your approval right now.',
                  )
                : const EmptyState(icon: Icons.search_off_rounded, title: 'No matches'),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            sliver: SliverList.separated(
              itemCount: shown.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => ApprovalCard(shown[i], showStatus: widget.mine, onTap: () => _open(shown[i])),
            ),
          ),
      ]),
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _FilterChip({required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Material(
        color: selected ? c.primary : c.surface,
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            child: Text(label,
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: selected ? Colors.white : c.onSurface)),
          ),
        ),
      ),
    );
  }
}

class ApprovalCard extends StatelessWidget {
  final ApprovalItem item;
  final bool showStatus;
  final VoidCallback onTap;
  const ApprovalCard(this.item, {super.key, required this.showStatus, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final (icon, color) = docTypeStyle(item.docType);
    return AppCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          IconBadge(icon, color, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(item.docTypeLabel,
                  style: t.textTheme.labelMedium?.copyWith(color: color, fontWeight: FontWeight.w700),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text(item.title, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            ]),
          ),
          if (showStatus) StatusChip(item.status) else Icon(Icons.chevron_right_rounded, color: t.colorScheme.outline),
        ]),
        if ((item.summary ?? '').isNotEmpty) ...[
          const SizedBox(height: 12),
          Text(item.summary!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
        ],
        const SizedBox(height: 14),
        Row(children: [
          if (item.requestedBy != null && !showStatus) ...[
            InitialsAvatar(item.requestedBy!, size: 26),
            const SizedBox(width: 8),
            Flexible(
              child: Text(item.requestedBy!,
                  style: t.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
            ),
            Text('  •  ', style: t.textTheme.bodySmall),
          ],
          if (item.createdAt != null)
            Text(timeAgo(item.createdAt!), style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
          const Spacer(),
          if (item.amount != null)
            Text(money(item.amount!), style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        ]),
      ]),
    );
  }
}

class StatusChip extends StatelessWidget {
  final String status;
  final bool onGradient;
  const StatusChip(this.status, {super.key, this.onGradient = false});

  @override
  Widget build(BuildContext context) {
    final (color, icon) = switch (status) {
      'Approved' => (AppColors.success, Icons.check_circle_rounded),
      'Rejected' => (AppColors.danger, Icons.cancel_rounded),
      'Withdrawn' => (const Color(0xFF6B7280), Icons.undo_rounded),
      _ => (AppColors.warning, Icons.schedule_rounded),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: onGradient ? Colors.white.withValues(alpha: 0.2) : color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: onGradient ? Colors.white : color),
        const SizedBox(width: 4),
        Text(status, style: TextStyle(color: onGradient ? Colors.white : color, fontSize: 12, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}
