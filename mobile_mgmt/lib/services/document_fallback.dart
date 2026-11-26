import 'api_client.dart';

/// For servers without /approval/document: load the referenced document from the
/// endpoints the web app already uses, and turn it into the same shape
/// ({title, fields, lines, line_columns, totals}) that DocumentView renders.
class DocumentFallback {
  static final _api = ApiClient.instance;

  /// [refType] is the cancellable type ("Invoice", "GRN", ...) for cancellation requests,
  /// otherwise the approval doc_type ("purchase_order", ...).
  static Future<Map<String, dynamic>?> load({
    int? locationId,
    required bool cancellation,
    required String refType,
    required int docId,
    String? docNo,
    String? title,
    String? reason,
  }) async {
    dynamic raw;
    try {
      raw = await _fetch(cancellation, refType, docId, docNo, locationId);
    } on ApiException catch (e) {
      if (e.status == 403)
        throw ApiException(
            403, 'You do not have permission to view this document.');
      if (e.status == 404)
        throw ApiException(
            404, 'The document was not found. It may have been deleted.');
      rethrow;
    }
    if (raw is! Map) return null;
    final doc = normalize(raw.cast<String, dynamic>(), title: title);
    if (reason != null && reason.isNotEmpty) {
      (doc['fields'] as List)
          .insert(0, {'label': 'Cancellation reason', 'value': reason});
    }
    return doc;
  }

  static Future<dynamic> _fetch(bool cancellation, String refType, int docId,
      String? docNo, int? locationId) async {
    if (cancellation) {
      if (docNo == null || docNo.isEmpty) return null;
      return _api.get('/cancellation/lookup',
          query: {'type': refType, 'number': docNo}, locationId: locationId);
    } else {
      final path = switch (refType) {
        'purchase_order' => '/purchase/get/$docId',
        'stock_count' => '/stockcount/get/$docId',
        'stock_requisition' => '/stockrequisition/get/$docId',
        'expense' => '/expense/get/$docId',
        'discount' => null,
        _ => '',
      };
      if (path == '') return null;
      return path == null
          ? _api.get('/cancellation/lookup',
              query: {'type': 'Invoice', 'number': '$docId'},
              locationId: locationId)
          : _api.get(path, locationId: locationId);
    }
  }

  // ---------------------------------------------------------------- shape conversion

  static const _skip = {
    'id',
    'items',
    'lines',
    'details',
    'impact',
    'password',
    'cancelled_at',
    'cancellation_reason',
    'created_at',
    'updated_at',
    'offline_id',
    'device_id',
    'modifiers_json',
    'price_display_mode',
  };
  static const _nameKeys = [
    'description',
    'part_name',
    'item_name',
    'product_name',
    'name'
  ];
  static const _qtyKeys = [
    'quantity',
    'qty_ordered',
    'qty_requested',
    'qty_received',
    'qty',
    'physical_stock'
  ];
  static const _priceKeys = ['unit_price', 'unit_cost', 'price', 'cost_price'];
  static const _totalKeys = ['line_total', 'total', 'variance', 'amount'];
  static const _docTotalKeys = [
    'grand_total',
    'total_amount',
    'amount',
    'total'
  ];

  static double? _d(dynamic v) =>
      v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

  static String _label(String k) {
    final map = {
      'number': 'Number',
      'name': 'Customer / supplier',
      'date': 'Date',
      'po_number': 'PO number',
      'grn_number': 'GRN number',
      'supplier_name': 'Supplier',
      'location_name': 'Location',
      'created_by_name': 'Created by',
      'ordered_at': 'Ordered',
      'expected_at': 'Expected',
      'last_grn_number': 'Last GRN',
      'requisition_number': 'Request number',
      'from_location_name': 'From',
      'to_location_name': 'To',
      'count_number': 'Count number',
      'voucher_no': 'Voucher',
      'payee_name': 'Payee',
      'payment_date': 'Payment date',
      'payment_method': 'Method',
    };
    if (map.containsKey(k)) return map[k]!;
    final s = k.replaceAll('_', ' ').trim();
    return s.isEmpty ? k : s[0].toUpperCase() + s.substring(1);
  }

  static dynamic _first(Map m, List<String> keys) {
    for (final k in keys) {
      if (m[k] != null && '${m[k]}'.isNotEmpty) return m[k];
    }
    return null;
  }

  static Map<String, dynamic> normalize(Map<String, dynamic> raw,
      {String? title}) {
    // Some endpoints wrap the header: {purchase_order: {...}, items: [...]}. Lift nested header maps up.
    final m = <String, dynamic>{};
    raw.forEach((k, v) {
      if (v is Map && k != 'impact') {
        v.forEach((ik, iv) => m.putIfAbsent('$ik', () => iv));
      }
    });
    raw.forEach((k, v) {
      if (v is! Map || k == 'impact') m[k] = v;
    });
    final fields = <Map<String, dynamic>>[];
    final usedForTotal =
        _docTotalKeys.firstWhere((k) => _d(m[k]) != null, orElse: () => '');
    m.forEach((k, v) {
      if (_skip.contains(k) ||
          k.endsWith('_id') ||
          k.endsWith('_by') ||
          k == usedForTotal) return;
      if (v == null || v is Map || v is List) return;
      final s = '$v'.trim();
      if (s.isEmpty || s == '0' || s == '0.00') return;
      fields.add({'label': _label(k), 'value': s});
    });

    // Line items: first list of maps (items / lines / details / anything)
    List rows = const [];
    for (final k in ['items', 'lines', 'details']) {
      if (m[k] is List) {
        rows = m[k] as List;
        break;
      }
    }
    if (rows.isEmpty) {
      for (final v in m.values) {
        if (v is List && v.isNotEmpty && v.first is Map) {
          rows = v;
          break;
        }
      }
    }
    final isCount = rows.isNotEmpty &&
        rows.first is Map &&
        (rows.first as Map).containsKey('physical_stock');
    final lines = rows.whereType<Map>().map((r) {
      if (isCount) {
        return {
          'name': '${_first(r, _nameKeys) ?? 'Item'}',
          'qty': _d(r['system_stock']),
          'price': _d(r['physical_stock']),
          'total': _d(r['variance']),
          'note': r['notes'],
        };
      }
      final qty = _d(_first(r, _qtyKeys));
      final price = _d(_first(r, _priceKeys));
      var total = _d(_first(r, _totalKeys));
      if (total == null && qty != null && price != null) total = qty * price;
      return {
        'name': '${_first(r, _nameKeys) ?? 'Item'}',
        'qty': qty,
        'price': price,
        'total': total,
        'note': r['unit']
      };
    }).toList();
    final hasMoney = lines.any((l) => l['price'] != null);

    var total = usedForTotal.isEmpty ? null : _d(m[usedForTotal]);
    // No document total (e.g. purchase orders): add up the lines.
    if (total == null && hasMoney) total = lines.fold<double>(0, (s, l) => s + ((l['total'] as double?) ?? 0));
    return {
      'title': title ??
          '${m['number'] ?? m['po_number'] ?? m['grn_number'] ?? 'Document'}',
      'fields': fields,
      'lines': lines,
      'line_columns': isCount
          ? ['System', 'Counted', 'Variance']
          : (hasMoney ? ['Qty', 'Price', 'Total'] : ['Qty']),
      'totals': total != null
          ? [
              {'label': 'Total', 'value': total}
            ]
          : [],
      // What cancelling reverses (cancellation lookup of an invoice); rendered by ImpactView
      if (m['impact'] is Map) 'impact': m['impact'],
    };
  }
}
