import 'package:flutter/material.dart';

import '../theme.dart';
import 'format.dart';
import 'ui.dart';

double? _d(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

String _num(double v) => v % 1 == 0 ? '${v.toInt()}' : v.toStringAsFixed(2);

/// Renders /approval/document: header fields, line items, totals (server: helpers/ApprovalDocument.php).
class DocumentView extends StatelessWidget {
  final Map<String, dynamic> doc;
  const DocumentView(this.doc, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final fields = (doc['fields'] as List? ?? const []).whereType<Map>().toList();
    final lines = (doc['lines'] as List? ?? const []).whereType<Map>().toList();
    final cols = (doc['line_columns'] as List? ?? const []).map((e) => '$e').toList();
    final totals = (doc['totals'] as List? ?? const []).whereType<Map>().toList();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      AppCard(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            const IconBadge(Icons.description_rounded, AppColors.primary, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Text('${doc['title'] ?? 'Document'}',
                  style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 8),
          for (final f in fields)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 7),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                SizedBox(
                  width: 120,
                  child: Text('${f['label']}', style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                ),
                Expanded(
                  child: Text('${f['value']}',
                      textAlign: TextAlign.right,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: f['label'] == 'Cancellation reason' ? AppColors.danger : null,
                      )),
                ),
              ]),
            ),
        ]),
      ),
      if (lines.isNotEmpty) ...[
        const SizedBox(height: 12),
        AppCard(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${lines.length} ${lines.length == 1 ? 'item' : 'items'}',
                style: t.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            for (final (i, l) in lines.indexed) ...[
              if (i > 0) const Divider(),
              _LineRow(l.cast<String, dynamic>(), cols),
            ],
          ]),
        ),
      ],
      if (totals.isNotEmpty) ...[
        const SizedBox(height: 12),
        AppCard(
          child: Column(children: [
            for (final (i, tot) in totals.indexed)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(children: [
                  Expanded(
                    child: Text('${tot['label']}',
                        style: i == totals.length - 1
                            ? t.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800)
                            : t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                  ),
                  Text(money(_d(tot['value']) ?? 0),
                      style: i == totals.length - 1
                          ? t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800, color: t.colorScheme.primary)
                          : const TextStyle(fontWeight: FontWeight.w600)),
                ]),
              ),
          ]),
        ),
      ],
    ]);
  }
}

class _LineRow extends StatelessWidget {
  final Map<String, dynamic> l;
  final List<String> cols;
  const _LineRow(this.l, this.cols);

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final qty = _d(l['qty']);
    final price = _d(l['price']);
    final total = _d(l['total']);
    final money3 = cols.length == 3 && cols.last == 'Total';
    // Money documents: "2 × LKR 1,500.00" + total on the right. Stock counts: System / Counted / Variance.
    final String sub;
    final String? right;
    if (money3) {
      sub = '${qty != null ? _num(qty) : '-'} × ${price != null ? money(price) : '-'}';
      right = total != null ? money(total) : null;
    } else if (cols.length == 3) {
      sub = '${cols[0]} ${qty != null ? _num(qty) : '-'}  â€¢  ${cols[1]} ${price != null ? _num(price) : '-'}';
      right = total != null ? '${total > 0 ? '+' : ''}${_num(total)}' : null;
    } else {
      sub = '${cols.isNotEmpty ? cols[0] : 'Qty'} ${qty != null ? _num(qty) : '-'}';
      right = null;
    }
    final variance = !money3 && cols.length == 3 && total != null && total != 0;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${l['name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 2),
            Text(sub, style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
            if ((l['note'] ?? '').toString().isNotEmpty)
              Text('${l['note']}', style: t.textTheme.bodySmall?.copyWith(fontStyle: FontStyle.italic)),
          ]),
        ),
        if (right != null)
          Padding(
            padding: const EdgeInsets.only(left: 12),
            child: Text(right,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: variance ? (total < 0 ? AppColors.danger : AppColors.success) : null,
                )),
          ),
      ]),
    );
  }
}
