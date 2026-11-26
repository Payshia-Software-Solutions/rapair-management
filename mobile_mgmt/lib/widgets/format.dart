import 'package:intl/intl.dart';

final _money = NumberFormat.decimalPatternDigits(locale: 'en_US', decimalDigits: 2);
final _compact = NumberFormat.compact(locale: 'en_US');

/// "LKR 1,234.50"
String money(double v) => 'LKR ${_money.format(v)}';

/// "1.2M" style for tiles and chart axes.
String compact(double v) => _compact.format(v);

String shortDate(DateTime d) => DateFormat('d MMM').format(d);

String timeAgo(DateTime d) {
  final s = DateTime.now().difference(d);
  if (s.inMinutes < 1) return 'just now';
  if (s.inMinutes < 60) return '${s.inMinutes} min ago';
  if (s.inHours < 24) return '${s.inHours} h ago';
  return DateFormat('d MMM, HH:mm').format(d);
}
