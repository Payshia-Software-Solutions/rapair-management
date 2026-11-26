import 'package:flutter/material.dart';

import '../../services/api_client.dart';
import '../../services/approval_service.dart';
import '../../theme.dart';
import '../../widgets/document_view.dart';
import '../../widgets/format.dart';
import '../../widgets/impact_view.dart';
import '../../widgets/ui.dart';
import 'approvals_screen.dart' show StatusChip;

/// Gradient hero (amount, summary, status), requester, document details (payload), timeline,
/// and approve / reject / withdraw. Pops `true` when the request changed, so lists reload.
class ApprovalDetailScreen extends StatefulWidget {
  final int requestId;
  /// Set for a cancellation request: shown from this item (there is no detail endpoint),
  /// and decided through /cancellation/approve|reject.
  final ApprovalItem? cancellation;
  const ApprovalDetailScreen({super.key, required this.requestId, this.cancellation});

  @override
  State<ApprovalDetailScreen> createState() => _ApprovalDetailScreenState();
}

class _ApprovalDetailScreenState extends State<ApprovalDetailScreen> {
  final _svc = ApprovalService.instance;
  ApprovalDetail? _d;
  String? _error;
  bool _busy = false;
  String? _busyLabel; // "Approving…" etc. while a decision is being sent
  bool? _busyApprove; // which button shows the spinner
  bool _changed = false;
  Map<String, dynamic>? _doc;
  bool _docLoading = true;
  String? _docError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _loadDoc() async {
    final item = _d?.item;
    if (item == null) return;
    try {
      final doc = await _svc.document(item);
      if (mounted) setState(() => _doc = doc);
    } on ApiException catch (e) {
      if (mounted) setState(() => _docError = e.message);
    } finally {
      if (mounted) setState(() => _docLoading = false);
    }
  }

  Future<void> _load() async {
    final c = widget.cancellation;
    if (c != null) {
      setState(() => _d = ApprovalDetail(c, c.status == 'Pending', false, null, [
            ApprovalAction.local('Submitted', c.requestedBy, c.summary, c.createdAt),
          ]));
      await _loadDoc();
      return;
    }
    try {
      final d = await _svc.detail(widget.requestId);
      if (mounted) {
        setState(() {
          _d = d;
          _error = null;
        });
        await _loadDoc();
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.status == 404 ? 'This request is not available to you.' : e.message);
    }
  }

  Future<void> _decide(bool approve) async {
    if (_busy) return;
    final comment = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => _DecisionSheet(approve: approve, item: _d!.item),
    );
    if (comment == null || _busy) return; // cancelled, or already sending
    setState(() {
      _busy = true;
      _busyApprove = approve;
      _busyLabel = approve ? 'Approving…' : 'Rejecting…';
    });
    try {
      final msg = widget.cancellation != null
          ? await _svc.actCancellation(widget.requestId, approve: approve, note: comment)
          : await _svc.act(widget.requestId, approve: approve, comment: comment);
      _changed = true;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      _load(); // someone else may have acted first (409)
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _busyApprove = null;
          _busyLabel = null;
        });
      }
    }
  }

  Future<void> _withdraw() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw this request?'),
        content: const Text('The document goes back to draft and approvers no longer see it.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(110, 44)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Withdraw'),
          ),
        ],
      ),
    );
    if (ok != true || _busy) return;
    setState(() {
      _busy = true;
      _busyLabel = 'Withdrawing…';
    });
    try {
      await _svc.withdraw(widget.requestId);
      _changed = true;
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _busyLabel = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _d;
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && !_busy) Navigator.pop(context, _changed); // no leaving mid-decision
      },
      child: Stack(children: [
        Scaffold(
        body: d == null
            ? Column(children: [
                GradientHeader(
                  padding: const EdgeInsets.fromLTRB(8, 4, 20, 24),
                  child: Row(children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                      onPressed: () => Navigator.pop(context, _changed),
                    ),
                    const Text('Approval', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700)),
                  ]),
                ),
                Expanded(
                  child: _error != null
                      ? EmptyState(icon: Icons.lock_outline_rounded, title: 'Not available', message: _error)
                      : const Center(child: CircularProgressIndicator()),
                ),
              ])
            : RefreshIndicator(onRefresh: _load, child: _body(context, d)),
        bottomNavigationBar: d == null ? null : _actions(context, d),
        ),
        if (_busyLabel != null) Positioned.fill(child: _BusyOverlay(_busyLabel!)),
      ]),
    );
  }

  Widget _body(BuildContext context, ApprovalDetail d) {
    final t = Theme.of(context);
    final it = d.item;
    final (icon, _) = docTypeStyle(it.docType);
    return ListView(padding: EdgeInsets.zero, children: [
      GradientHeader(
        padding: const EdgeInsets.fromLTRB(8, 4, 20, 28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            IconButton(
              icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
              onPressed: () => Navigator.pop(context, _changed),
            ),
            const Spacer(),
            StatusChip(it.status, onGradient: true),
          ]),
          Padding(
            padding: const EdgeInsets.only(left: 12, top: 8),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(icon, color: Colors.white70, size: 18),
                const SizedBox(width: 6),
                Flexible(
                  child: Text('${it.docTypeLabel}  •  ${it.title}',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontWeight: FontWeight.w600)),
                ),
              ]),
              const SizedBox(height: 10),
              if (it.amount != null)
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(money(it.amount!),
                      style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                ),
              if ((it.summary ?? '').isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(it.summary!, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 15, height: 1.35)),
              ],
            ]),
          ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
        child: AppCard(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(children: [
            if (it.requestedBy != null)
              ListTile(
                leading: InitialsAvatar(it.requestedBy!, size: 40),
                title: Text(it.requestedBy!, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(it.createdAt != null ? 'Requested ${timeAgo(it.createdAt!)}' : 'Requester'),
              ),
            if (it.status == 'Pending' && it.currentLevel != null) ...[
              const Divider(indent: 16, endIndent: 16),
              _row('Stage', it.levelLabel ?? 'Level ${it.currentLevel}${it.levelCount != null ? ' of ${it.levelCount}' : ''}'),
            ],
            const Divider(indent: 16, endIndent: 16),
            _row('Document', it.title),
            if (it.location != null) ...[
              const Divider(indent: 16, endIndent: 16),
              _row('Location', it.location!),
            ],
          ]),
        ),
      ),
      if (_docLoading)
        const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
      else if (_doc != null) ...[
        const SectionTitle('Document'),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: DocumentView(_doc!)),
      ] else if (_docError != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Text('Could not load the document: $_docError', style: t.textTheme.bodySmall),
        ),
      if (d.payload != null) ...[
        const SectionTitle('Details'),
        Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _PayloadView(d.payload)),
      ],
      if (it.isCancellation && _doc?['impact'] is Map) ...[
        const SectionTitle('What gets reversed'),
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
          child: Text(
            it.status == 'Pending'
                ? 'Approving cancels all of this along with the ${it.refType.toLowerCase()}.'
                : 'Cancelling this ${it.refType.toLowerCase()} affects all of this.',
            style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: ImpactView((_doc!['impact'] as Map).cast<String, dynamic>()),
        ),
      ] else if (it.isCancellation && it.status == 'Pending')
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: AppColors.warning.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(16)),
            child: const Row(children: [
              Icon(Icons.warning_amber_rounded, color: AppColors.warning),
              SizedBox(width: 10),
              Expanded(child: Text('Approving cancels this document right away and reverses its stock, payments and accounting entries.')),
            ]),
          ),
        ),
      const SectionTitle('Timeline'),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: AppCard(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Column(children: [
            for (final (i, a) in d.actions.indexed) _Timeline(a, last: i == d.actions.length - 1),
            if (d.actions.isEmpty) Padding(padding: const EdgeInsets.all(12), child: Text('No activity yet', style: t.textTheme.bodySmall)),
          ]),
        ),
      ),
      const SizedBox(height: 100),
    ]);
  }

  Widget _row(String k, String v) => ListTile(
        dense: true,
        title: Text(k, style: Theme.of(context).textTheme.bodySmall),
        trailing: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 220),
          child: Text(v, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600)),
        ),
      );

  Widget? _actions(BuildContext context, ApprovalDetail d) {
    final t = Theme.of(context);
    Widget bar(Widget child) => Container(
          decoration: BoxDecoration(
            color: t.colorScheme.surface,
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 20, offset: const Offset(0, -4))],
          ),
          child: SafeArea(child: Padding(padding: const EdgeInsets.fromLTRB(16, 12, 16, 12), child: child)),
        );
    if (d.canAct && d.item.status == 'Pending') {
      return bar(Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.danger,
              side: const BorderSide(color: AppColors.danger, width: 1.5),
            ),
            onPressed: _busy ? null : () => _decide(false),
            icon: _busyApprove == false ? const _Spinner(color: AppColors.danger) : const Icon(Icons.close_rounded),
            label: Text(_busyApprove == false ? 'Rejecting…' : 'Reject'),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.success,
              disabledBackgroundColor: AppColors.success.withValues(alpha: _busyApprove == true ? 0.85 : 0.4),
              disabledForegroundColor: Colors.white,
            ),
            onPressed: _busy ? null : () => _decide(true),
            icon: _busyApprove == true ? const _Spinner(color: Colors.white) : const Icon(Icons.check_rounded),
            label: Text(_busyApprove == true ? 'Approving…' : 'Approve'),
          ),
        ),
      ]));
    }
    // Requester can pull back a pending request.
    if (d.item.status == 'Pending' && d.isMine) {
      return bar(OutlinedButton.icon(
        onPressed: _busy ? null : _withdraw,
        icon: const Icon(Icons.undo_rounded),
        label: const Text('Withdraw request'),
      ));
    }
    return null;
  }
}

/// Approve: optional comment. Reject: reason required (the requester sees it).
class _DecisionSheet extends StatefulWidget {
  final bool approve;
  final ApprovalItem item;
  const _DecisionSheet({required this.approve, required this.item});

  @override
  State<_DecisionSheet> createState() => _DecisionSheetState();
}

class _DecisionSheetState extends State<_DecisionSheet> {
  final _c = TextEditingController();
  String? _err;
  bool _submitted = false;

  void _submit() {
    if (_submitted) return; // double tap would pop the detail screen too
    if (!widget.approve && _c.text.trim().isEmpty) {
      setState(() => _err = 'Give a reason so the requester knows what to fix.');
      return;
    }
    _submitted = true;
    Navigator.pop(context, _c.text.trim());
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final it = widget.item;
    final color = widget.approve ? AppColors.success : AppColors.danger;
    return Padding(
      padding: EdgeInsets.fromLTRB(24, 0, 24, MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Row(children: [
          IconBadge(widget.approve ? Icons.check_rounded : Icons.close_rounded, color, size: 48),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget.approve ? 'Approve request' : 'Reject request',
                  style: t.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
              Text([it.title, if (it.amount != null) money(it.amount!)].join('  •  '),
                  style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant)),
            ]),
          ),
        ]),
        const SizedBox(height: 20),
        TextField(
          controller: _c,
          autofocus: !widget.approve,
          maxLength: 500,
          maxLines: 3,
          minLines: 2,
          decoration: InputDecoration(
            hintText: widget.approve ? 'Add a comment (optional)' : 'Why are you rejecting this?',
            errorText: _err,
          ),
        ),
        const SizedBox(height: 8),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: color),
          onPressed: _submit,
          child: Text(widget.approve ? 'Approve' : 'Reject'),
        ),
        const SizedBox(height: 4),
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
      ]),
    );
  }
}

class _Timeline extends StatelessWidget {
  final ApprovalAction a;
  final bool last;
  const _Timeline(this.a, {this.last = false});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final (icon, color) = switch (a.action) {
      'Approved' => (Icons.check_rounded, AppColors.success),
      'Rejected' => (Icons.close_rounded, AppColors.danger),
      'Withdrawn' => (Icons.undo_rounded, const Color(0xFF6B7280)),
      _ => (Icons.send_rounded, AppColors.primary),
    };
    return IntrinsicHeight(
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Column(children: [
          const SizedBox(height: 8),
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.14), shape: BoxShape.circle),
            child: Icon(icon, size: 16, color: color),
          ),
          if (!last) Expanded(child: Container(width: 2, color: t.colorScheme.outlineVariant.withValues(alpha: 0.6))),
        ]),
        const SizedBox(width: 12),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 10, bottom: 14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('${a.action}${a.levelNo != null && a.action != 'Submitted' ? ' • level ${a.levelNo}' : ''}',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 2),
              Text([a.userName, if (a.at != null) timeAgo(a.at!)].whereType<String>().join(' • '),
                  style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
              if ((a.comment ?? '').isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 8),
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: t.colorScheme.primary.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(a.comment!, style: t.textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
                ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/// Generic view of a request's stored payload: scalars as rows, lists of maps as line cards.
class _PayloadView extends StatelessWidget {
  final dynamic data;
  const _PayloadView(this.data);

  static String _label(String k) {
    final s = k.replaceAll('_', ' ').trim();
    return s.isEmpty ? k : s[0].toUpperCase() + s.substring(1);
  }

  static String _fmt(dynamic v) {
    if (v is num) return v % 1 == 0 ? '${v.toInt()}' : v.toStringAsFixed(2);
    return '$v';
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    if (data is List) return _lines(context, data as List);
    if (data is! Map) return Text(_fmt(data));
    final m = (data as Map).cast<String, dynamic>();
    final scalars = m.entries.where((e) => e.value != null && e.value is! Map && e.value is! List && '${e.value}'.isNotEmpty);
    final nested = m.entries.where((e) => e.value is List || e.value is Map);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      if (scalars.isNotEmpty)
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Column(children: [
            for (final e in scalars)
              ListTile(
                dense: true,
                title: Text(_label(e.key), style: t.textTheme.bodySmall),
                trailing: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 200),
                  child: Text(_fmt(e.value), textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
          ]),
        ),
      for (final e in nested) ...[
        const SizedBox(height: 14),
        Text(_label(e.key), style: t.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        e.value is List ? _lines(context, e.value as List) : _PayloadView(e.value),
      ],
    ]);
  }

  Widget _lines(BuildContext context, List list) {
    final t = Theme.of(context);
    return Column(children: [
      for (final row in list.take(50))
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: AppCard(
            padding: const EdgeInsets.all(12),
            child: SizedBox(
              width: double.infinity,
              child: row is Map
                  ? Wrap(spacing: 14, runSpacing: 4, children: [
                      for (final e in row.entries.where((e) => e.value != null && e.value is! Map && e.value is! List))
                        Text.rich(TextSpan(children: [
                          TextSpan(text: '${_label('${e.key}')}: ', style: t.textTheme.bodySmall),
                          TextSpan(text: _fmt(e.value), style: const TextStyle(fontWeight: FontWeight.w600)),
                        ])),
                    ])
                  : Text(_fmt(row)),
            ),
          ),
        ),
      if (list.length > 50) Text('+${list.length - 50} more', style: t.textTheme.bodySmall),
    ]);
  }
}

class _Spinner extends StatelessWidget {
  final Color color;
  const _Spinner({required this.color});
  @override
  Widget build(BuildContext context) =>
      SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2, color: color));
}

/// Dims the screen and swallows taps while a decision is being sent.
class _BusyOverlay extends StatelessWidget {
  final String label;
  const _BusyOverlay(this.label);

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return AbsorbPointer(
      child: Container(
        color: Colors.black.withValues(alpha: 0.35),
        alignment: Alignment.center,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 24),
          decoration: BoxDecoration(color: t.colorScheme.surface, borderRadius: BorderRadius.circular(22)),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const SizedBox(width: 40, height: 40, child: CircularProgressIndicator(strokeWidth: 3.4)),
            const SizedBox(height: 16),
            Text(label, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Please wait, do not close the app',
                style: t.textTheme.bodySmall?.copyWith(color: t.colorScheme.onSurfaceVariant)),
          ]),
        ),
      ),
    );
  }
}
