import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'document_fallback.dart';

double? _dn(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));
int _i(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;

/// One row of /approval/inbox or /approval/mine (Approval::present on the server),
/// or a cancellation request from /cancellation/requests ([isCancellation]).
class ApprovalItem {
  final int id;
  final bool isCancellation;
  final String? location;
  final int? locationId;
  /// Approval: the document's id (approval_requests.doc_id). Cancellation: the cancelled document's id.
  final int docId;
  /// Cancellation: the cancelled document's type ("Invoice", "GRN", ...). Approval: same as docType.
  final String refType;
  final String docType, docTypeLabel, status;
  final String? docNo, summary, levelLabel, requestedBy;
  final double? amount;
  final int? currentLevel, levelCount;
  final DateTime? createdAt;

  ApprovalItem.fromJson(Map<String, dynamic> j)
      : id = _i(j['id']),
        isCancellation = false,
        location = null,
        locationId = j['location_id'] == null ? null : _i(j['location_id']),
        docId = _i(j['doc_id']),
        refType = '${j['doc_type'] ?? ''}',
        docType = '${j['doc_type'] ?? ''}',
        docTypeLabel = '${j['doc_type_label'] ?? j['doc_type'] ?? ''}',
        status = '${j['status'] ?? 'Pending'}',
        docNo = j['doc_no']?.toString(),
        summary = j['summary']?.toString(),
        levelLabel = j['level_label']?.toString(),
        requestedBy = (j['requested_by_name'] ?? j['requested_by'])?.toString(),
        amount = _dn(j['amount']),
        currentLevel = j['current_level'] == null ? null : _i(j['current_level']),
        levelCount = j['level_count'] == null ? null : _i(j['level_count']),
        createdAt = DateTime.tryParse('${j['created_at']}');

  /// Cancellation request row (cancellation_requests): summary is the requester's reason.
  ApprovalItem.fromCancellation(Map<String, dynamic> j)
      : id = _i(j['id']),
        isCancellation = true,
        location = j['location_name']?.toString(),
        locationId = j['location_id'] == null ? null : _i(j['location_id']),
        docId = _i(j['doc_id']),
        refType = '${j['doc_type'] ?? ''}',
        docType = 'cancellation',
        docTypeLabel = 'Cancel ${j['doc_type'] ?? 'document'}',
        status = switch ('${j['status']}') { 'approved' => 'Approved', 'rejected' => 'Rejected', _ => 'Pending' },
        docNo = j['doc_no']?.toString(),
        summary = j['reason']?.toString(),
        levelLabel = null,
        requestedBy = j['requested_by_name']?.toString(),
        amount = _dn(j['amount']),
        currentLevel = null,
        levelCount = null,
        createdAt = DateTime.tryParse('${j['requested_at'] ?? j['created_at']}');

  String get title => docNo?.isNotEmpty == true ? docNo! : '#$id';
}

class ApprovalAction {
  final String action;
  final String? userName, comment;
  final int? levelNo;
  final DateTime? at;
  ApprovalAction.local(this.action, this.userName, this.comment, this.at) : levelNo = null;

  ApprovalAction.fromJson(Map<String, dynamic> j)
      : action = '${j['action']}',
        userName = j['user_name']?.toString(),
        comment = j['comment']?.toString(),
        levelNo = j['level_no'] == null ? null : _i(j['level_no']),
        at = DateTime.tryParse('${j['created_at']}');
}

class ApprovalDetail {
  final ApprovalItem item;
  final bool canAct;
  final bool isMine;
  final dynamic payload; // decoded JSON for documents that only exist after approval
  final List<ApprovalAction> actions;
  ApprovalDetail(this.item, this.canAct, this.isMine, this.payload, this.actions);
}

/// Approvals API plus the inbox badge count (listened to by the bottom nav).
class ApprovalService extends ChangeNotifier {
  ApprovalService._();
  static final ApprovalService instance = ApprovalService._();
  final _api = ApiClient.instance;

  int inboxCount = 0;

  Future<void> refreshCount() async {
    try {
      await inbox();
    } catch (_) {}
  }

  /// Approval-workflow requests plus cancellation requests this user can decide.
  /// Cancellations already in the approval workflow come through approval/inbox, so they're skipped here.
  Future<List<ApprovalItem>> inbox() async {
    final approvals = _api.get('/approval/inbox');
    List<ApprovalItem> cancels;
    try {
      cancels = await _cancellations();
    } catch (_) {
      cancels = []; // no permission / older server: just none
    }
    final d = await approvals;
    final list = [
      ...(d is List ? d : const []).whereType<Map>().map((m) => ApprovalItem.fromJson(m.cast())),
      ...cancels,
    ]..sort((a, b) => (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)));
    inboxCount = list.length;
    notifyListeners();
    return list;
  }

  Future<List<ApprovalItem>> _cancellations() async {
    final d = await _api.get('/cancellation/requests', query: {'status': 'pending'});
    final rows = (d is Map && d['requests'] is List) ? d['requests'] as List : const [];
    return rows
        .whereType<Map>()
        .map((m) => m.cast<String, dynamic>())
        .where((m) => m['can_decide'] == true && m['in_workflow'] != true)
        .map(ApprovalItem.fromCancellation)
        .toList();
  }

  /// The referenced document (fields, lines, totals) or null when the type has none.
  /// Uses /approval/document; on servers that don't have it yet (404), falls back to the
  /// existing document endpoints (see DocumentFallback).
  Future<Map<String, dynamic>?> document(ApprovalItem item) async {
    try {
      final d = await _api.get('/approval/document/${item.id}', query: item.isCancellation ? {'source': 'cancellation'} : null);
      return d is Map ? d.cast<String, dynamic>() : null;
    } on ApiException catch (e) {
      if (e.status != 404) rethrow;
    }
    return DocumentFallback.load(
      locationId: item.locationId,
      cancellation: item.isCancellation,
      refType: item.refType,
      docId: item.docId,
      docNo: item.docNo,
      title: item.isCancellation ? '${item.refType} ${item.docNo ?? ''}'.trim() : '${item.docTypeLabel} ${item.title}',
      reason: item.isCancellation ? item.summary : null,
    );
  }

  /// Approve = the document is cancelled now. Reject = it stays as is.
  Future<String> actCancellation(int id, {required bool approve, String? note}) async {
    await _api.post('/cancellation/${approve ? 'approve' : 'reject'}/$id', {
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    await refreshCount();
    return approve ? 'Approved. The document is cancelled.' : 'Rejected';
  }

  Future<List<ApprovalItem>> mine() async {
    final d = await _api.get('/approval/mine');
    return (d is List ? d : const []).whereType<Map>().map((m) => ApprovalItem.fromJson(m.cast())).toList();
  }

  Future<ApprovalDetail> detail(int id) async {
    final d = await _api.get('/approval/history/$id');
    final r = (d['request'] as Map).cast<String, dynamic>();
    dynamic payload;
    final raw = r['payload'];
    if (raw is String && raw.isNotEmpty) {
      try {
        payload = jsonDecode(raw);
      } catch (_) {}
    } else if (raw is Map || raw is List) {
      payload = raw;
    }
    final actions = (d['actions'] is List ? d['actions'] as List : const [])
        .whereType<Map>()
        .map((m) => ApprovalAction.fromJson(m.cast()))
        .toList();
    var canAct = r['can_act'] == true;
    var isMine = r['is_mine'] == true;
    // Servers before the mobile changes don't send can_act / is_mine / labels: work them out from
    // the inbox (already limited to requests this user may decide) and the user's own requests.
    if (!r.containsKey('can_act')) {
      final res = await Future.wait([
        _api.get('/approval/inbox').catchError((_) => null),
        _api.get('/approval/mine').catchError((_) => null),
      ]);
      Map? find(dynamic list) =>
          (list is List ? list : const []).whereType<Map>().where((m) => _i(m['id']) == id).firstOrNull;
      final inInbox = find(res[0]);
      final inMine = find(res[1]);
      canAct = inInbox != null;
      isMine = inMine != null;
      final extra = inInbox ?? inMine;
      if (extra != null) {
        for (final k in ['doc_type_label', 'level_label', 'level_count']) {
          r.putIfAbsent(k, () => extra[k]);
        }
      }
    }
    return ApprovalDetail(ApprovalItem.fromJson(r), canAct, isMine, payload, actions);
  }

  /// Returns the server's message ("Approved", "Approved; sent to the next level", "Rejected").
  Future<String> act(int id, {required bool approve, String? comment}) async {
    await _api.post('/approval/act/$id', {
      'decision': approve ? 'approve' : 'reject',
      if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
    });
    await refreshCount();
    return approve ? 'Approved' : 'Rejected';
  }

  Future<void> withdraw(int id) => _api.post('/approval/withdraw/$id');
}
