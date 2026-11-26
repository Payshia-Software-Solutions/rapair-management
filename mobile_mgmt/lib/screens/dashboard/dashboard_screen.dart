import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../services/api_client.dart';
import '../../services/approval_service.dart';
import '../../services/dashboard_service.dart';
import '../../services/session.dart';
import '../../theme.dart';
import '../../widgets/charts.dart';
import '../../widgets/format.dart';
import '../../widgets/ui.dart';
import 'detail_lists.dart';

class DashboardScreen extends StatefulWidget {
  /// Opens the Approvals tab (from the "pending approvals" card).
  final VoidCallback? onOpenApprovals;
  const DashboardScreen({super.key, this.onOpenApprovals});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _svc = DashboardService();
  int? _locationId; // null = all my locations
  DashboardData? _data;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _load(initial: true);
  }

  Future<void> _load({bool initial = false}) async {
    final s = context.read<Session>();
    if (!initial) {
      s.refreshLocations();
    }
    if (initial) {
      final c = await _svc.cached(_locationId);
      if (mounted && c != null) setState(() => _data = c);
    }
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await _svc.fetch(
        locationId: _locationId,
        sales: s.canSeeDashboards,
        ops: s.canSeeOperations,
        allowedNames:
            s.isAdmin ? const [] : s.locations.map((l) => l.name).toList(),
      );
      if (mounted) setState(() => _data = d);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickLocation() async {
    final s = context.read<Session>();
    await s.refreshLocations(); // pick up branches added since sign-in
    if (!mounted) return;
    final picked = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
                child: Text('Show figures for',
                    style: Theme.of(ctx)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
              ),
              _LocationOption(
                  icon: Icons.public,
                  label: 'All my locations',
                  selected: _locationId == null,
                  onTap: () => Navigator.pop(ctx, 0)),
              for (final l in s.locations)
                _LocationOption(
                    icon: Icons.storefront_outlined,
                    label: l.name,
                    selected: _locationId == l.id,
                    onTap: () => Navigator.pop(ctx, l.id)),
              const SizedBox(height: 12),
            ]),
      ),
    );
    if (picked == null) return;
    _selectLocation(picked == 0 ? null : picked);
  }

  void _selectLocation(int? id) {
    if (id == _locationId) return;
    setState(() {
      _locationId = id;
      _data = null;
    });
    _load(initial: true);
  }

  String _locationLabel(Session s) {
    if (_locationId == null)
      return s.locations.length > 1
          ? 'All locations'
          : (s.locations.firstOrNull?.name ?? 'All locations');
    for (final l in s.locations) {
      if (l.id == _locationId) return l.name;
    }
    return 'Location';
  }

  static String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final d = _data;
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _load,
        edgeOffset: 120,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _header(context, s, d)),
            if (d == null)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _error != null
                    ? EmptyState(
                        icon: Icons.cloud_off_rounded,
                        title: 'Could not load',
                        message: _error,
                        action: 'Try again',
                        onAction: _load)
                    : const Center(child: CircularProgressIndicator()),
              )
            else
              SliverList.list(children: [
                if (_error != null)
                  Padding(
                      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                      child: _OfflineBanner(_error!)),
                if (d.sales != null) ..._sales(context, d.sales!),
                if (d.ops != null) ..._ops(context, d.ops!),
                const SizedBox(height: 28),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _header(BuildContext context, Session s, DashboardData? d) {
    final sales = d?.sales;
    double? change;
    if (sales != null && sales.trend.length >= 2) {
      final y = sales.trend[sales.trend.length - 2].revenue;
      if (y > 0) change = (sales.todayRevenue - y) / y * 100;
    }
    final first = (s.name ?? '').split(' ').first;
    return Stack(children: [
      Padding(
        padding: const EdgeInsets.only(bottom: 44),
        child: GradientHeader(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 64),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              InitialsAvatar(s.name ?? '?', size: 42, onGradient: true),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(_greeting(),
                          style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 13)),
                      Text(first.isEmpty ? 'Welcome' : first,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w700)),
                    ]),
              ),
              if (_loading)
                const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
              else
                IconButton(
                    onPressed: _load,
                    icon:
                        const Icon(Icons.refresh_rounded, color: Colors.white)),
            ]),
            const SizedBox(height: 18),
            if (s.locations.length > 1)
              _LocationStrip(
                locations: s.locations,
                selected: _locationId,
                onSelect: _selectLocation,
              )
            else
              GlassChip(
                icon: Icons.storefront_outlined,
                label: _locationLabel(s),
                onTap: s.isAdmin ? _pickLocation : null,
              ),
            if (d != null) ...[
              const SizedBox(height: 8),
              Text(
                  d.fromCache
                      ? 'Saved ${timeAgo(d.fetchedAt)}'
                      : 'Updated ${timeAgo(d.fetchedAt)}',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.75),
                      fontSize: 12)),
            ],
            if (sales != null) ...[
              const SizedBox(height: 22),
              Text("Today's revenue",
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 14)),
              const SizedBox(height: 4),
              Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Flexible(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(money(sales.todayRevenue),
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5)),
                  ),
                ),
                if (change != null) ...[
                  const SizedBox(width: 10),
                  _ChangePill(change),
                ],
              ]),
              const SizedBox(height: 6),
              Text(
                  '${sales.todayCount} ${sales.todayCount == 1 ? 'invoice' : 'invoices'}  •  ${money(sales.todayCollection)} collected',
                  style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 13)),
            ],
          ]),
        ),
      ),
      // Stat cards overlap the header's bottom edge (kept inside the Stack so they stay tappable)
      Positioned(
        left: 16,
        right: 16,
        bottom: 0,
        child: Row(children: [
          if (sales != null)
            Expanded(
                child: _MiniStat(
                    label: 'This month',
                    value: compact(sales.monthRevenue),
                    icon: Icons.calendar_month_rounded,
                    color: AppColors.primary)),
          if (sales != null) const SizedBox(width: 12),
          Expanded(
            child: ListenableBuilder(
              listenable: ApprovalService.instance,
              builder: (_, __) => _MiniStat(
                label: 'Pending approvals',
                value: '${ApprovalService.instance.inboxCount}',
                icon: Icons.fact_check_rounded,
                color: AppColors.warning,
                onTap: widget.onOpenApprovals,
              ),
            ),
          ),
        ]),
      ),
    ]);
  }

  List<Widget> _sales(BuildContext context, SalesDashboard x) {
    final t = Theme.of(context);
    return [
      const SizedBox(height: 12),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          Expanded(
            child: _StatCard(
              label: 'This year',
              value: compact(x.yearRevenue),
              sub: '${compact(x.yearCollection)} collected',
              icon: Icons.trending_up_rounded,
              color: AppColors.success,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _StatCard(
              label: 'Outstanding',
              value: compact(x.outstanding),
              sub: 'Unpaid invoices',
              icon: Icons.account_balance_wallet_rounded,
              color: AppColors.danger,
            ),
          ),
        ]),
      ),
      if (_locationId == null && x.byLocation.length > 1) ...[
        const SectionTitle('Sales by location'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: _ByLocationCard(
            rows: x.byLocation,
            onTap: (name) {
              final s = context.read<Session>();
              final loc = s.locations.where((l) => l.name == name).firstOrNull;
              if (loc != null) _selectLocation(loc.id);
            },
          ),
        ),
      ],
      const SectionTitle('Revenue trend'),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AppCard(
          padding: const EdgeInsets.fromLTRB(8, 18, 18, 10),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Padding(
              padding: const EdgeInsets.only(left: 10, bottom: 12),
              child: Row(children: [
                Text('Last 30 days',
                    style: t.textTheme.bodySmall
                        ?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                const Spacer(),
                Text(money(x.trend.fold<double>(0, (s, p) => s + p.revenue)),
                    style: t.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700)),
              ]),
            ),
            RevenueTrendChart(x.trend),
          ]),
        ),
      ),
      if (x.paymentMethods.isNotEmpty) ...[
        const SectionTitle('Payment methods'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            child: ShareBars([
              for (final p in x.paymentMethods)
                (label: p.method, value: p.amount, display: money(p.amount)),
            ]),
          ),
        ),
      ],
      if (x.topItems.isNotEmpty) ...[
        SectionTitle('Top items',
            action: x.topItems.length > 5 ? 'See all' : null,
            onAction: () => Navigator.push(context,
                MaterialPageRoute(builder: (_) => TopItemsScreen(x.topItems)))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(children: [
              for (final (i, it) in x.topItems.take(5).indexed)
                TopItemTile(i + 1, it)
            ]),
          ),
        ),
      ],
      if (x.recentSales.isNotEmpty) ...[
        SectionTitle('Recent sales',
            action: x.recentSales.length > 5 ? 'See all' : null,
            onAction: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => RecentSalesScreen(x.recentSales)))),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(
                children: [for (final r in x.recentSales.take(5)) SaleTile(r)]),
          ),
        ),
      ],
    ];
  }

  List<Widget> _ops(BuildContext context, OpsDashboard x) {
    final t = Theme.of(context);
    final open = x.ordersByStatus.entries
        .where((e) => e.key != 'Completed' && e.key != 'Cancelled')
        .fold<int>(0, (s, e) => s + e.value);
    return [
      const SectionTitle('Workshop'),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(children: [
          Expanded(
              child: _StatCard(
                  label: 'Open',
                  value: '$open',
                  icon: Icons.build_circle_rounded,
                  color: AppColors.primary)),
          const SizedBox(width: 10),
          Expanded(
              child: _StatCard(
                  label: 'Done today',
                  value: '${x.completedToday}',
                  icon: Icons.task_alt_rounded,
                  color: AppColors.success)),
          const SizedBox(width: 10),
          Expanded(
            child: _StatCard(
                label: 'Avg repair',
                value: '${x.avgRepairHours.toStringAsFixed(1)}h',
                icon: Icons.timer_rounded,
                color: AppColors.info),
          ),
        ]),
      ),
      if (x.throughput.isNotEmpty) ...[
        const SectionTitle('Orders, last 7 days'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(child: ThroughputChart(x.throughput)),
        ),
      ],
      if (x.ordersByStatus.isNotEmpty) ...[
        const SectionTitle('Orders by status'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            child: ShareBars([
              for (final e in x.ordersByStatus.entries)
                (
                  label: e.key,
                  value: e.value.toDouble(),
                  display: '${e.value}'
                ),
            ]),
          ),
        ),
      ],
      if (x.urgent.isNotEmpty) ...[
        const SectionTitle('Needs attention'),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: AppCard(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Column(children: [
              for (final u in x.urgent)
                ListTile(
                  leading: const IconBadge(
                      Icons.priority_high_rounded, AppColors.danger,
                      size: 38),
                  title: Text('#${u['id']}  ${u['vehicle_model'] ?? ''}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text([u['priority'], u['status']]
                      .where((e) => e != null && '$e'.isNotEmpty)
                      .join(' • ')),
                  trailing: u['expected_time'] != null
                      ? Text(
                          shortDate(
                              DateTime.tryParse('${u['expected_time']}') ??
                                  DateTime.now()),
                          style: t.textTheme.labelSmall)
                      : null,
                ),
            ]),
          ),
        ),
      ],
    ];
  }
}

class _ChangePill extends StatelessWidget {
  final double pct;
  const _ChangePill(this.pct);
  @override
  Widget build(BuildContext context) {
    final up = pct >= 0;
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(up ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
            size: 14, color: Colors.white),
        const SizedBox(width: 2),
        Text('${pct.abs().toStringAsFixed(0)}% vs yesterday',
            style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  final VoidCallback? onTap;
  const _MiniStat(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color,
      this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(14),
      child: Row(children: [
        IconBadge(icon, color, size: 42),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label,
                style: t.textTheme.labelSmall
                    ?.copyWith(color: t.colorScheme.onSurfaceVariant),
                maxLines: 1,
                overflow: TextOverflow.ellipsis),
            const SizedBox(height: 2),
            Text(value,
                style: t.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w800)),
          ]),
        ),
      ]),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label, value;
  final String? sub;
  final IconData icon;
  final Color color;
  const _StatCard(
      {required this.label,
      required this.value,
      this.sub,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AppCard(
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        IconBadge(icon, color, size: 36),
        const SizedBox(height: 12),
        Text(label,
            style: t.textTheme.labelMedium
                ?.copyWith(color: t.colorScheme.onSurfaceVariant),
            maxLines: 1,
            overflow: TextOverflow.ellipsis),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(value,
              style: t.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w800)),
        ),
        if (sub != null) ...[
          const SizedBox(height: 2),
          Text(sub!,
              style: t.textTheme.bodySmall
                  ?.copyWith(color: t.colorScheme.onSurfaceVariant),
              maxLines: 1,
              overflow: TextOverflow.ellipsis),
        ],
      ]),
    );
  }
}

class _LocationOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _LocationOption(
      {required this.icon,
      required this.label,
      required this.selected,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.primary;
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24),
      leading: IconBadge(icon, c, size: 38),
      title: Text(label,
          style: TextStyle(
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500)),
      trailing: selected ? Icon(Icons.check_circle_rounded, color: c) : null,
      onTap: onTap,
    );
  }
}

class _OfflineBanner extends StatelessWidget {
  final String text;
  const _OfflineBanner(this.text);
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: AppColors.warning.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          const Icon(Icons.cloud_off_rounded,
              size: 18, color: AppColors.warning),
          const SizedBox(width: 10),
          Expanded(
              child: Text('Showing saved figures. $text',
                  style: Theme.of(context).textTheme.bodySmall)),
        ]),
      );
}

/// Swipeable row of location pills on the header: "All" + each location.
class _LocationStrip extends StatelessWidget {
  final List<Location> locations;
  final int? selected;
  final ValueChanged<int?> onSelect;
  const _LocationStrip(
      {required this.locations,
      required this.selected,
      required this.onSelect});

  @override
  Widget build(BuildContext context) {
    Widget pill(String label, IconData icon, int? id) {
      final sel = selected == id;
      return Padding(
        padding: const EdgeInsets.only(right: 8),
        child: Material(
          color: sel ? Colors.white : Colors.white.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(30),
          child: InkWell(
            borderRadius: BorderRadius.circular(30),
            onTap: () => onSelect(id),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                Icon(icon,
                    size: 16, color: sel ? AppColors.primary : Colors.white),
                const SizedBox(width: 6),
                Text(label,
                    style: TextStyle(
                        color: sel ? AppColors.primary : Colors.white,
                        fontWeight: FontWeight.w700,
                        fontSize: 13)),
              ]),
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 38,
      child: ListView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        children: [
          pill('All', Icons.public, null),
          for (final l in locations)
            pill(l.name, Icons.storefront_outlined, l.id),
        ],
      ),
    );
  }
}

/// "All" view: each location's today and month sales, with a share bar of the month.
class _ByLocationCard extends StatelessWidget {
  final List<
      ({
        String name,
        double today,
        int todayCount,
        double month,
        double monthPaid
      })> rows;
  final ValueChanged<String> onTap;
  const _ByLocationCard({required this.rows, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final top = rows.fold<double>(0, (m, r) => r.month > m ? r.month : m);
    final totalToday = rows.fold<double>(0, (s, r) => s + r.today);
    final totalMonth = rows.fold<double>(0, (s, r) => s + r.month);
    return AppCard(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: Column(children: [
        Row(children: [
          const Expanded(child: SizedBox()),
          SizedBox(
              width: 92,
              child: Text('Today',
                  textAlign: TextAlign.right, style: t.textTheme.labelSmall)),
          SizedBox(
              width: 100,
              child: Text('This month',
                  textAlign: TextAlign.right, style: t.textTheme.labelSmall)),
        ]),
        for (final (i, r) in rows.indexed)
          InkWell(
            onTap: () => onTap(r.name),
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Column(children: [
                Row(children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: [
                        AppColors.primary,
                        AppColors.violet,
                        AppColors.info,
                        AppColors.success,
                        AppColors.warning
                      ][i % 5],
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(r.name,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis),
                          Text(
                              '${r.todayCount} ${r.todayCount == 1 ? 'invoice' : 'invoices'} today',
                              style: t.textTheme.bodySmall?.copyWith(
                                  color: t.colorScheme.onSurfaceVariant)),
                        ]),
                  ),
                  SizedBox(
                    width: 92,
                    child: Text(compact(r.today),
                        textAlign: TextAlign.right,
                        style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  SizedBox(
                    width: 100,
                    child: Text(compact(r.month),
                        textAlign: TextAlign.right,
                        style: TextStyle(
                            fontWeight: FontWeight.w800,
                            color: t.colorScheme.primary)),
                  ),
                ]),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: top > 0 ? r.month / top : 0,
                    minHeight: 5,
                    color: [
                      AppColors.primary,
                      AppColors.violet,
                      AppColors.info,
                      AppColors.success,
                      AppColors.warning
                    ][i % 5],
                    backgroundColor:
                        t.colorScheme.primary.withValues(alpha: 0.07),
                  ),
                ),
              ]),
            ),
          ),
        const Divider(),
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(children: [
            const Expanded(
                child: Text('All locations',
                    style: TextStyle(fontWeight: FontWeight.w800))),
            SizedBox(
                width: 92,
                child: Text(compact(totalToday),
                    textAlign: TextAlign.right,
                    style: const TextStyle(fontWeight: FontWeight.w800))),
            SizedBox(
              width: 100,
              child: Text(compact(totalMonth),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      color: t.colorScheme.primary)),
            ),
          ]),
        ),
      ]),
    );
  }
}
