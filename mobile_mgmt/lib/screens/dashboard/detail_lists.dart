import 'package:flutter/material.dart';

import '../../theme.dart';
import '../../widgets/format.dart';
import '../../widgets/ui.dart';

typedef TopItem = ({String name, double qty, double revenue});

class TopItemTile extends StatelessWidget {
  final int rank;
  final TopItem item;
  const TopItemTile(this.rank, this.item, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return ListTile(
      leading: Container(
        width: 34,
        height: 34,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: rank <= 3 ? AppColors.headerGradient : null,
          color: rank <= 3 ? null : t.colorScheme.primary.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(11),
        ),
        child: Text('$rank',
            style: TextStyle(fontWeight: FontWeight.w800, color: rank <= 3 ? Colors.white : t.colorScheme.primary)),
      ),
      title: Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text('Qty ${item.qty % 1 == 0 ? item.qty.toInt() : item.qty.toStringAsFixed(2)}'),
      trailing: Text(money(item.revenue), style: t.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
    );
  }
}

class SaleTile extends StatelessWidget {
  final Map<String, dynamic> sale;
  const SaleTile(this.sale, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final total = sale['total'] is num ? (sale['total'] as num).toDouble() : double.tryParse('${sale['total']}') ?? 0;
    final status = '${sale['status'] ?? ''}';
    final paid = status.toLowerCase() == 'paid';
    final date = DateTime.tryParse('${sale['date']}');
    return ListTile(
      leading: InitialsAvatar('${sale['customer_name'] ?? 'Walk in'}', size: 38),
      title: Text('${sale['customer_name'] ?? 'Walk-in'}',
          maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text([sale['invoice_no'] ?? '', if (date != null) shortDate(date), status].where((e) => '$e'.isNotEmpty).join(' • ')),
      trailing: Text(money(total),
          style: t.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
            color: paid ? AppColors.success : t.colorScheme.error,
          )),
    );
  }
}

class TopItemsScreen extends StatelessWidget {
  final List<TopItem> items;
  const TopItemsScreen(this.items, {super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Top items')),
        body: ListView.separated(
          itemCount: items.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (_, i) => TopItemTile(i + 1, items[i]),
        ),
      );
}

class RecentSalesScreen extends StatelessWidget {
  final List<Map<String, dynamic>> sales;
  const RecentSalesScreen(this.sales, {super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Recent sales')),
        body: ListView.separated(
          itemCount: sales.length,
          separatorBuilder: (_, __) => const Divider(height: 1),
          itemBuilder: (_, i) => SaleTile(sales[i]),
        ),
      );
}
