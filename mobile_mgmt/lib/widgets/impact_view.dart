import 'package:flutter/material.dart';

import '../theme.dart';
import 'format.dart';
import 'ui.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
String _num(double v) => v % 1 == 0 ? '${v.toInt()}' : v.toStringAsFixed(2);
String _date(dynamic v) {
  final d = DateTime.tryParse('$v');
  return d == null ? '${v ?? ''}' : shortDate(d) + (d.year != DateTime.now().year ? ' ${d.year}' : '');
}

/// "What gets reversed" for an invoice cancellation: Payments / Stock / Journal entries tabs.
/// Data: CancellationController::invoiceImpact (also ApprovalDocument::invoiceImpact).
class ImpactView extends StatefulWidget {
  final Map<String, dynamic> impact;
  const ImpactView(this.impact, {super.key});

  @override
  State<ImpactView> createState() => _ImpactViewState();
}

class _ImpactViewState extends State<ImpactView> {
  int _tab = 0;

  List<Map<String, dynamic>> _list(String k) =>
      (widget.impact[k] as List? ?? const []).whereType<Map>().map((m) => m.cast<String, dynamic>()).toList();

  @override
  void initState() {
    super.initState();
    // Open the first tab that has something in it
    final counts = [_list('payments').length, _list('stock').length, _list('journals').length];
    final i = counts.indexWhere((c) => c > 0);
    if (i > 0) _tab = i;
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final payments = _list('payments');
    final stock = _list('stock');
    final journals = _list('journals');
    final blocker = widget.impact['blocker']?.toString();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (blocker != null && blocker.isNotEmpty) ...[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(16)),
          child: Row(children: [
            const Icon(Icons.block_rounded, color: AppColors.danger),
            const SizedBox(width: 10),
            Expanded(child: Text(blocker, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600))),
          ]),
        ),
        const SizedBox(height: 12),
      ],
      AppCard(
        padding: EdgeInsets.zero,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // Tabs
          Container(
            margin: const EdgeInsets.all(8),
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: t.colorScheme.primary.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(children: [
              _tabBtn('Payments', payments.length, 0),
              _tabBtn('Stock', stock.length, 1),
              _tabBtn('Journals', journals.length, 2),
            ]),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 200),
            alignment: Alignment.topCenter,
            child: switch (_tab) {
              0 => _payments(context, payments),
              1 => _stock(context, stock),
              _ => _journals(context, journals),
            },
          ),
        ]),
      ),
    ]);
  }

  Widget _tabBtn(String label, int count, int i) {
    final t = Theme.of(context);
    final sel = _tab == i;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = i),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: sel ? t.colorScheme.surface : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            boxShadow: sel ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 6, offset: const Offset(0, 2))] : null,
          ),
          child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Flexible(
              child: Text(label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                    fontSize: 13,
                    color: sel ? t.colorScheme.primary : t.colorScheme.onSurfaceVariant,
                  )),
            ),
            const SizedBox(width: 5),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
              decoration: BoxDecoration(
                color: sel ? t.colorScheme.primary : t.colorScheme.outlineVariant.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('$count',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: sel ? Colors.white : t.colorScheme.onSurfaceVariant)),
            ),
          ]),
        ),
      ),
    );
  }

  Widget _empty(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
        child: Text(text, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
      );

  Widget _footer(String label, String value) {
    final t = Theme.of(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: t.colorScheme.outlineVariant.withValues(alpha: 0.5)))),
      child: Row(children: [
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700))),
        Text(value, style: t.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800, color: AppColors.danger)),
      ]),
    );
  }

  Widget _payments(BuildContext context, List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return _empty('No payments on this invoice.');
    final t = Theme.of(context);
    final total = rows.fold<double>(0, (s, r) => s + _d(r['amount']));
    return Column(children: [
      for (final r in rows)
        ListTile(
          leading: const IconBadge(Icons.payments_rounded, AppColors.success, size: 38),
          title: Text('${r['receipt_no'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text([r['payment_method'], _date(r['payment_date'])].where((e) => e != null && '$e'.isNotEmpty).join(' • ')),
          trailing: Text(money(_d(r['amount'])), style: t.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
        ),
      _footer('Refund / reverse', money(total)),
    ]);
  }

  Widget _stock(BuildContext context, List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return _empty('No stock moved by this invoice.');
    final t = Theme.of(context);
    return Column(children: [
      for (final r in rows)
        Builder(builder: (_) {
          // Sold items left stock (negative); cancelling puts them back.
          final back = -_d(r['qty_change']);
          return ListTile(
            leading: const IconBadge(Icons.inventory_2_rounded, AppColors.info, size: 38),
            title: Text('${r['part_name'] ?? 'Item'}', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text([r['location_name'], if (r['batch_number'] != null) 'Batch ${r['batch_number']}', r['movement_type']]
                .where((e) => e != null && '$e'.isNotEmpty)
                .join(' • ')),
            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text('${back >= 0 ? '+' : ''}${_num(back)} ${r['unit'] ?? ''}'.trim(),
                  style: t.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700, color: back >= 0 ? AppColors.success : AppColors.danger)),
              Text('back to stock', style: t.textTheme.labelSmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
            ]),
          );
        }),
    ]);
  }

  Widget _journals(BuildContext context, List<Map<String, dynamic>> rows) {
    if (rows.isEmpty) return _empty('No journal entries for this invoice.');
    final t = Theme.of(context);
    return Column(children: [
      for (final (i, j) in rows.indexed) ...[
        if (i > 0) const Divider(),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${j['description'] ?? j['ref_type'] ?? 'Journal entry'}',
                      style: const TextStyle(fontWeight: FontWeight.w600), maxLines: 2, overflow: TextOverflow.ellipsis),
                  Text('${_date(j['entry_date'])} • ${j['ref_type'] ?? ''}',
                      style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                ]),
              ),
              Text(money(_d(j['total_amount'])), style: const TextStyle(fontWeight: FontWeight.w700)),
            ]),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: t.colorScheme.primary.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(children: [
                for (final l in (j['lines'] as List? ?? const []).whereType<Map>())
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(children: [
                      Expanded(
                        child: Text('${l['account_code'] ?? ''}  ${l['account_name'] ?? ''}'.trim(),
                            style: t.textTheme.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      SizedBox(
                        width: 86,
                        child: Text(_d(l['debit']) > 0 ? 'Dr ${_num(_d(l['debit']))}' : '',
                            textAlign: TextAlign.right, style: t.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
                      ),
                      SizedBox(
                        width: 86,
                        child: Text(_d(l['credit']) > 0 ? 'Cr ${_num(_d(l['credit']))}' : '',
                            textAlign: TextAlign.right, style: t.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600)),
                      ),
                    ]),
                  ),
              ]),
            ),
          ]),
        ),
      ],
      _footer('Entries reversed', '${rows.length}'),
    ]);
  }
}
