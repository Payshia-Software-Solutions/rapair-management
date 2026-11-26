import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'format.dart';

/// 30-day revenue line with touch tooltip.
class RevenueTrendChart extends StatelessWidget {
  final List<({DateTime date, double revenue})> points;
  const RevenueTrendChart(this.points, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final c = t.colorScheme.primary;
    if (points.isEmpty) return const SizedBox(height: 180, child: Center(child: Text('No sales in this period')));
    final maxY = max(1.0, points.map((p) => p.revenue).reduce(max)) * 1.15;
    return SizedBox(
      height: 200,
      child: LineChart(LineChartData(
        minY: 0,
        maxY: maxY,
        gridData: FlGridData(
          drawVerticalLine: false,
          horizontalInterval: maxY / 4,
          getDrawingHorizontalLine: (_) => FlLine(color: t.colorScheme.outlineVariant, strokeWidth: 0.6),
        ),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 40,
              interval: maxY / 4,
              getTitlesWidget: (v, m) => v == 0 || v >= maxY
                  ? const SizedBox.shrink()
                  : Text(compact(v), style: t.textTheme.labelSmall),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              interval: 7,
              reservedSize: 24,
              getTitlesWidget: (v, m) {
                final i = v.toInt();
                // Every 7th day, and none in the last 3 (the axis end label would overlap).
                if (i < 0 || i >= points.length || v != i.toDouble() || i > points.length - 4) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(shortDate(points[i].date), style: t.textTheme.labelSmall),
                );
              },
            ),
          ),
        ),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (_) => t.colorScheme.inverseSurface,
            getTooltipItems: (spots) => spots
                .map((s) => LineTooltipItem(
                      '${shortDate(points[s.x.toInt()].date)}\n${money(s.y)}',
                      TextStyle(color: t.colorScheme.onInverseSurface, fontSize: 12),
                    ))
                .toList(),
          ),
        ),
        lineBarsData: [
          LineChartBarData(
            spots: [for (var i = 0; i < points.length; i++) FlSpot(i.toDouble(), points[i].revenue)],
            isCurved: true,
            preventCurveOverShooting: true,
            color: c,
            barWidth: 2.5,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [c.withValues(alpha: 0.25), c.withValues(alpha: 0)],
              ),
            ),
          ),
        ],
      )),
    );
  }
}

/// Received vs completed orders per day (last 7 days).
class ThroughputChart extends StatelessWidget {
  final List<({DateTime date, int received, int completed})> days;
  const ThroughputChart(this.days, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    if (days.isEmpty) return const SizedBox.shrink();
    final top = days.map((d) => max(d.received, d.completed)).fold<int>(0, max);
    final maxY = max(1, top) * 1.2;
    final rc = t.colorScheme.primary.withValues(alpha: 0.45);
    final cc = t.colorScheme.primary;
    return Column(children: [
      SizedBox(
        height: 170,
        child: BarChart(BarChartData(
          maxY: maxY,
          gridData: const FlGridData(show: false),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            topTitles: const AxisTitles(),
            rightTitles: const AxisTitles(),
            leftTitles: const AxisTitles(),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (v, m) {
                  final i = v.toInt();
                  if (i < 0 || i >= days.length) return const SizedBox.shrink();
                  return Text(shortDate(days[i].date), style: t.textTheme.labelSmall);
                },
              ),
            ),
          ),
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipColor: (_) => t.colorScheme.inverseSurface,
              getTooltipItem: (g, gi, rod, ri) => BarTooltipItem(
                '${ri == 0 ? 'Received' : 'Completed'}: ${rod.toY.toInt()}',
                TextStyle(color: t.colorScheme.onInverseSurface, fontSize: 12),
              ),
            ),
          ),
          barGroups: [
            for (var i = 0; i < days.length; i++)
              BarChartGroupData(x: i, barsSpace: 3, barRods: [
                BarChartRodData(toY: days[i].received.toDouble(), color: rc, width: 9, borderRadius: BorderRadius.circular(3)),
                BarChartRodData(toY: days[i].completed.toDouble(), color: cc, width: 9, borderRadius: BorderRadius.circular(3)),
              ]),
          ],
        )),
      ),
      const SizedBox(height: 8),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        _Legend(rc, 'Received'),
        const SizedBox(width: 16),
        _Legend(cc, 'Completed'),
      ]),
    ]);
  }
}

class _Legend extends StatelessWidget {
  final Color color;
  final String label;
  const _Legend(this.color, this.label);
  @override
  Widget build(BuildContext context) => Row(children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(2))),
        const SizedBox(width: 6),
        Text(label, style: Theme.of(context).textTheme.labelSmall),
      ]);
}

/// Horizontal share bars (payment methods, order statuses).
class ShareBars extends StatelessWidget {
  final List<({String label, double value, String display})> rows;
  const ShareBars(this.rows, {super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final total = rows.fold<double>(0, (s, r) => s + r.value);
    if (rows.isEmpty || total <= 0) return const Padding(padding: EdgeInsets.all(16), child: Text('No data'));
    return Column(children: [
      for (final r in rows)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(r.label, style: t.textTheme.bodyMedium)),
              Text(r.display, style: t.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
            ]),
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(value: r.value / total, minHeight: 6),
            ),
          ]),
        ),
    ]);
  }
}
