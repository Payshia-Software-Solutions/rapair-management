import 'dart:convert';

import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';

double _d(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
List<Map<String, dynamic>> _list(dynamic v) => v is List
    ? v.whereType<Map>().map((m) => m.cast<String, dynamic>()).toList()
    : [];

/// GET /api/dashboard/sales
class SalesDashboard {
  final double todayRevenue,
      todayCollection,
      monthRevenue,
      monthCollection,
      yearRevenue,
      yearCollection,
      outstanding;
  final int todayCount;
  final List<({DateTime date, double revenue})> trend; // last 30 days
  final List<({String method, double amount})> paymentMethods;
  final List<({String name, double qty, double revenue})> topItems;
  final List<Map<String, dynamic>>
      recentSales; // id, invoice_no, customer_name, total, status, date
  /// "All" view: per-location figures (name, today, today_count, month, month_paid).
  final List<
      ({
        String name,
        double today,
        int todayCount,
        double month,
        double monthPaid
      })> byLocation;

  SalesDashboard.fromJson(Map<String, dynamic> j)
      : todayRevenue = _d(j['kpis']?['today']?['revenue']),
        todayCollection = _d(j['kpis']?['today']?['collection']),
        todayCount = _i(j['kpis']?['today']?['count']),
        monthRevenue = _d(j['kpis']?['month']?['revenue']),
        monthCollection = _d(j['kpis']?['month']?['collection']),
        yearRevenue = _d(j['kpis']?['year']?['revenue']),
        yearCollection = _d(j['kpis']?['year']?['collection']),
        outstanding = _d(j['kpis']?['outstanding']),
        trend = _list(j['revenueTrend'])
            .map((r) => (
                  date: DateTime.tryParse('${r['date']}') ?? DateTime.now(),
                  revenue: _d(r['revenue'])
                ))
            .toList(),
        paymentMethods = _list(j['paymentMethods'])
            .map((r) => (method: '${r['method']}', amount: _d(r['amount'])))
            .toList(),
        topItems = _list(j['topItems'])
            .map((r) => (
                  name: '${r['name']}',
                  qty: _d(r['qty']),
                  revenue: _d(r['revenue'])
                ))
            .toList(),
        recentSales = _list(j['recentSales']),
        byLocation = _list(j['byLocation'])
            .map((r) => (
                  name: '${r['name']}',
                  today: _d(r['today']),
                  todayCount: _i(r['today_count']),
                  month: _d(r['month']),
                  monthPaid: _d(r['month_paid']),
                ))
            .toList();
}

/// GET /api/dashboard/overview (workshop operations)
class OpsDashboard {
  final Map<String, int> ordersByStatus;
  final int completedToday;
  final double avgRepairHours;
  final List<({DateTime date, int received, int completed})>
      throughput; // last 7 days
  final List<Map<String, dynamic>>
      urgent; // id, vehicle_model, priority, status, expected_time

  OpsDashboard.fromJson(Map<String, dynamic> j)
      : ordersByStatus = (j['ordersByStatus'] is Map)
            ? (j['ordersByStatus'] as Map).map((k, v) => MapEntry('$k', _i(v)))
            : {},
        completedToday = _i(j['completedToday']),
        avgRepairHours = _d(j['avgRepairHours']),
        throughput = _list(j['throughputLast7Days'])
            .map((r) => (
                  date: DateTime.tryParse('${r['date']}') ?? DateTime.now(),
                  received: _i(r['received']),
                  completed: _i(r['completed'])
                ))
            .toList(),
        urgent = _list(j['urgentAttention']);
}

class DashboardData {
  final SalesDashboard? sales;
  final OpsDashboard? ops;
  final DateTime fetchedAt;
  final bool fromCache;
  DashboardData(this.sales, this.ops, this.fetchedAt, {this.fromCache = false});
}

/// Loads both dashboards; caches the raw JSON per location so the screen opens offline.
class DashboardService {
  final _api = ApiClient.instance;

  String _key(int? loc) =>
      'dash_cache_${_api.tenantHost ?? 'single'}_${loc ?? 'all'}';

  Future<DashboardData?> cached(int? locationId) async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_key(locationId));
    if (raw == null) return null;
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return _parse(j, fromCache: true);
    } catch (_) {
      return null;
    }
  }

  /// [allowedNames]: the user's locations, to keep the "All" breakdown to what they may see.
  Future<DashboardData> fetch(
      {int? locationId,
      required bool sales,
      required bool ops,
      List<String> allowedNames = const []}) async {
    final q = locationId != null ? {'location_id': locationId} : null;
    final results = await Future.wait([
      !sales
          ? Future.value(null)
          : locationId != null
              ? _salesForLocation(locationId)
              : _salesAll(allowedNames),
      ops ? _api.get('/dashboard/overview', query: q) : Future.value(null),
    ]);
    final j = {
      'sales': results[0],
      'ops': results[1],
      'at': DateTime.now().toIso8601String()
    };
    final p = await SharedPreferences.getInstance();
    await p.setString(_key(locationId), jsonEncode(j));
    return _parse(j);
  }

  static final _ymd = DateFormat('yyyy-MM-dd');

  /// "All": the usual dashboard plus today's and this month's sales per location (report/location_sales).
  Future<Map<String, dynamic>?> _salesAll(List<String> allowedNames) async {
    final now = DateTime.now();
    final today = _ymd.format(now);
    final monthStart = _ymd.format(DateTime(now.year, now.month, 1));
    final res = await Future.wait([
      _api.get('/dashboard/sales'),
      _api.get('/report/location_sales',
          query: {'from': today, 'to': today}).catchError((_) => null),
      _api.get('/report/location_sales',
          query: {'from': monthStart, 'to': today}).catchError((_) => null),
    ]);
    final base = res[0] is Map
        ? Map<String, dynamic>.from(res[0] as Map)
        : <String, dynamic>{};
    final byName = <String, Map<String, dynamic>>{};
    for (final r in _list(res[2])) {
      byName['${r['location_name']}'] = {
        'name': '${r['location_name']}',
        'month': _d(r['total_sales']),
        'month_paid': _d(r['total_paid']),
        'today': 0.0,
        'today_count': 0
      };
    }
    for (final r in _list(res[1])) {
      final m = byName.putIfAbsent(
          '${r['location_name']}',
          () => {
                'name': '${r['location_name']}',
                'month': 0.0,
                'month_paid': 0.0
              });
      m['today'] = _d(r['total_sales']);
      m['today_count'] = _i(r['invoice_count']);
    }
    var rows = byName.values.toList();
    if (allowedNames.isNotEmpty)
      rows = rows.where((r) => allowedNames.contains(r['name'])).toList();
    rows.sort((a, b) => (b['month'] as double).compareTo(a['month'] as double));
    base['byLocation'] = rows;
    return base;
  }

  /// One location, from reports that honour location_id and the user's access (works on any server version).
  /// Builds the same shape as /dashboard/sales.
  Future<Map<String, dynamic>> _salesForLocation(int locationId) async {
    final now = DateTime.now();
    final today = _ymd.format(now);
    final monthStart = DateTime(now.year, now.month, 1);
    final yearStart = _ymd.format(DateTime(now.year, 1, 1));
    final trendStart = DateTime(now.year, now.month, now.day)
        .subtract(const Duration(days: 29));
    final res = await Future.wait([
      _api.get('/report/sales_summary',
          query: {'location_id': locationId, 'from': yearStart, 'to': today}),
      _api.get('/report/top_selling_items', query: {
        'location_id': locationId,
        'from': _ymd.format(monthStart),
        'to': today,
        'limit': 10
      }).catchError((_) => null),
      _api.get('/report/invoice_report', query: {
        'location_id': locationId,
        'from': _ymd.format(trendStart),
        'to': today
      }).catchError((_) => null),
    ]);
    final days = <String, Map<String, dynamic>>{};
    for (final r in _list(res[0])) {
      days['${r['date']}'.substring(0, 10)] = r;
    }
    double sum(bool Function(String d) f, String k) => days.entries
        .where((e) => f(e.key))
        .fold<double>(0, (s, e) => s + _d(e.value[k]));
    final ms = _ymd.format(monthStart);
    final t = days[today];
    final yearGrand = sum((_) => true, 'total_grand');
    final yearPaid = sum((_) => true, 'total_paid');
    return {
      'kpis': {
        'today': {
          'revenue': _d(t?['total_grand']),
          'collection': _d(t?['total_paid']),
          'count': _i(t?['invoice_count'])
        },
        'month': {
          'revenue': sum((d) => d.compareTo(ms) >= 0, 'total_grand'),
          'collection': sum((d) => d.compareTo(ms) >= 0, 'total_paid'),
        },
        'year': {'revenue': yearGrand, 'collection': yearPaid},
        'outstanding': (yearGrand - yearPaid).clamp(0, double.infinity),
      },
      'revenueTrend': [
        for (var i = 0; i < 30; i++)
          () {
            final d = _ymd.format(trendStart.add(Duration(days: i)));
            return {'date': d, 'revenue': _d(days[d]?['total_grand'])};
          }(),
      ],
      'paymentMethods': const [],
      'topItems': [
        for (final r in _list(res[1]))
          {
            'name': r['description'],
            'qty': _d(r['total_qty']),
            'revenue': _d(r['total_revenue'])
          },
      ],
      'recentSales': [
        for (final r in _list(res[2]).take(10))
          {
            'id': r['id'],
            'invoice_no': r['invoice_no'],
            'customer_name': r['customer_name'],
            'total': _d(r['grand_total']),
            'status': r['status'],
            'date': r['issue_date'],
          },
      ],
    };
  }

  DashboardData _parse(Map<String, dynamic> j, {bool fromCache = false}) =>
      DashboardData(
        j['sales'] is Map
            ? SalesDashboard.fromJson(
                (j['sales'] as Map).cast<String, dynamic>())
            : null,
        j['ops'] is Map
            ? OpsDashboard.fromJson((j['ops'] as Map).cast<String, dynamic>())
            : null,
        DateTime.tryParse('${j['at']}') ?? DateTime.now(),
        fromCache: fromCache,
      );
}
