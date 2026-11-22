<?php
/**
 * Cancellation Controller
 * Centralized handling for document lookups and cancellations
 */
require_once '../app/helpers/CancellationRequestHelper.php';

class CancellationController extends Controller {
    protected $db;

    public function __construct() {
        $this->db = new Database();
    }

    /**
     * Everything an invoice cancellation reverses, so the requester and approver can see it:
     * payment receipts, stock movements (items, recipe ingredients, batches) and journal entries.
     */
    private function invoiceImpact($id) {
        $out = ['payments' => [], 'stock' => [], 'journals' => [], 'blocker' => null];

        $this->db->query("SELECT id, receipt_no, payment_method, amount, payment_date, status
                          FROM payment_receipts WHERE invoice_id = :id ORDER BY id ASC");
        $this->db->bind(':id', $id);
        $out['payments'] = $this->db->resultSet() ?: [];

        $this->db->query("SELECT sm.id, sm.qty_change, sm.movement_type, sm.unit_cost, p.part_name, p.unit,
                                 sl.name AS location_name, b.batch_number
                          FROM stock_movements sm
                          LEFT JOIN parts p ON p.id = sm.part_id
                          LEFT JOIN service_locations sl ON sl.id = sm.location_id
                          LEFT JOIN inventory_batches b ON b.id = sm.batch_id
                          WHERE sm.ref_table = 'invoices' AND sm.ref_id = :id
                          ORDER BY sm.id ASC");
        $this->db->bind(':id', $id);
        $out['stock'] = $this->db->resultSet() ?: [];

        $receiptIds = array_map(fn($p) => (int)$p->id, $out['payments']);
        $refs = "(ref_type IN ('Invoice','Payment') AND ref_id = " . (int)$id . ")";
        if ($receiptIds) $refs .= " OR (ref_type = 'PaymentReceipt' AND ref_id IN (" . implode(',', $receiptIds) . "))";
        $this->db->query("SELECT id, entry_date, description, ref_type, total_amount FROM acc_journal_entries
                          WHERE $refs ORDER BY id ASC");
        $out['journals'] = $this->db->resultSet() ?: [];
        foreach ($out['journals'] as $j) {
            $this->db->query("SELECT a.code AS account_code, a.name AS account_name, i.debit, i.credit
                              FROM acc_journal_items i JOIN acc_accounts a ON a.id = i.account_id
                              WHERE i.entry_id = :e ORDER BY i.debit DESC, i.id ASC");
            $this->db->bind(':e', $j->id);
            $j->lines = $this->db->resultSet() ?: [];
        }

        require_once '../app/models/Invoice.php';
        $inv = new Invoice();
        $b = $inv->cancelBlocker($id);
        if ($b && stripos($b, 'already cancelled') === false) $out['blocker'] = $b;
        return $out;
    }

    public function lookup() {
        $this->requireAuth();
        $type = $_GET['type'] ?? '';
        $number = $_GET['number'] ?? '';

        if (!$type || !$number) {
            $this->error('Type and Number are required');
        }

        $result = null;
        switch ($type) {
            case 'Invoice':
                require_once '../app/models/Invoice.php';
                $query = "SELECT i.id, i.invoice_no as number, c.name, i.grand_total as amount, i.issue_date as date, i.status, i.cancelled_at, i.cancellation_reason 
                                 FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.invoice_no = :num";
                if (is_numeric($number)) $query .= " OR i.id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                if($result) {
                    $this->db->query("SELECT description, quantity, unit_price, line_total FROM invoice_items WHERE invoice_id = :id");
                    $this->db->bind(':id', $result->id);
                    $result->items = $this->db->resultSet();
                    $result->impact = $this->invoiceImpact((int)$result->id);
                }
                break;

            case 'GRN':
                require_once '../app/models/GoodsReceiveNote.php';
                $query = "SELECT g.id, g.grn_number as number, s.name, g.total_amount as amount, g.received_at as date, g.status, g.cancelled_at, g.cancellation_reason 
                                 FROM goods_receive_notes g LEFT JOIN suppliers s ON g.supplier_id = s.id WHERE g.grn_number = :num";
                if (is_numeric($number)) $query .= " OR g.id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                if($result) {
                    $this->db->query("SELECT p.part_name as description, i.qty_received as quantity, i.unit_cost as unit_price, (i.qty_received * i.unit_cost) as line_total 
                                     FROM grn_items i JOIN parts p ON i.part_id = p.id WHERE i.grn_id = :id");
                    $this->db->bind(':id', $result->id);
                    $result->items = $this->db->resultSet();
                }
                break;

            case 'Expense':
                require_once '../app/models/Expense.php';
                $query = "SELECT id, voucher_no as number, payee_name as name, amount, payment_date as date, status, cancelled_at, cancellation_reason 
                                 FROM acc_expenses WHERE voucher_no = :num";
                if (is_numeric($number)) $query .= " OR id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                break;

            case 'PaymentReceipt':
                require_once '../app/models/PaymentReceipt.php';
                $query = "SELECT p.id, p.receipt_no as number, c.name as name, p.amount, p.payment_date as date, p.status, p.cancelled_at, p.cancellation_reason 
                                 FROM payment_receipts p LEFT JOIN customers c ON p.customer_id = c.id WHERE p.receipt_no = :num";
                if (is_numeric($number)) $query .= " OR p.id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                break;

            case 'VendorPayment':
                require_once '../app/models/SupplierPayment.php';
                $query = "SELECT p.id, p.reference_no as number, s.name, p.amount, p.payment_date as date, p.status, p.cancelled_at, p.cancellation_reason 
                                 FROM acc_supplier_payments p JOIN suppliers s ON p.supplier_id = s.id WHERE p.reference_no = :num";
                if (is_numeric($number)) $query .= " OR p.id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                break;

            case 'Reservation':
                require_once '../app/models/Reservation.php';
                $query = "SELECT res.id, res.reservation_no as number, c.name, res.total_amount as amount, res.check_in as date, res.status, res.cancelled_at, res.cancellation_reason 
                                 FROM hotel_reservations res JOIN customers c ON res.customer_id = c.id WHERE res.reservation_no = :num";
                if (is_numeric($number)) $query .= " OR res.id = :num";
                $query .= " LIMIT 1";
                $this->db->query($query);
                $this->db->bind(':num', $number);
                $result = $this->db->single();
                break;

            default:
                $this->error('Invalid document type');
        }

        if (!$result) {
            $this->error('Document not found');
        }

        $this->json(['status' => 'success', 'data' => $result]);
    }

    // Who may ASK for a cancellation (approval is the real control)
    const REQUEST_PERMS = ['invoices.write', 'payments.write', 'pos.checkout', 'accounting.write', 'parts.write', 'suppliers.write'];

    private function body() { return json_decode(file_get_contents('php://input'), true) ?: []; }

    // POST /api/cancellation/process { type, id, reason }  (kept for the old screen) -> creates a request
    public function process() {
        $this->request();
    }

    // POST /api/cancellation/request { type, id, reason }
    public function request() {
        $u = $this->requirePermission(self::REQUEST_PERMS);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        $d = $this->body();
        [$ok, $msg, $rid] = CancellationRequestHelper::create($this->db, (string)($d['type'] ?? ''), (int)($d['id'] ?? 0), $d['reason'] ?? '', (int)$u['sub']);
        if (!$ok) { $this->error($msg, 422); return; }
        // Approval workflow (when on): the request also goes to My Approvals with its levels.
        require_once '../app/helpers/Approval.php';
        if ($ok && $rid && Approval::isEnabled('cancellation')) {
            $this->db->query("SELECT doc_type, doc_no, amount, location_id, reason FROM cancellation_requests WHERE id = :id");
            $this->db->bind(':id', (int)$rid);
            $cr = $this->db->single();
            $r = Approval::submit('cancellation', (int)$rid, [
                'doc_no' => $cr->doc_no ?? null, 'amount' => $cr && $cr->amount !== null ? (float)$cr->amount : null,
                'location_id' => $cr && $cr->location_id ? (int)$cr->location_id : null,
                'summary' => 'Cancel ' . ($cr->doc_type ?? 'document') . ' ' . ($cr->doc_no ?? '') . ': ' . ($cr->reason ?? ''),
            ], (int)$u['sub']);
            // No level applies (e.g. below every amount limit): it stays with the usual
            // Cancellation Requests approvers, so nothing is cancelled without someone deciding.
            if ($r['status'] === 'Pending') {
                $this->success(['request_id' => $rid, 'status' => 'pending'], 'Sent for approval (' . $r['level'] . ')');
            }
        }
        $this->success(['request_id' => $rid, 'status' => 'pending'], $msg);
    }

    // GET /api/cancellation/requests?status=pending|approved|rejected|all&mine=1
    public function requests() {
        $u = $this->requireAuth();
        $status = (string)($_GET['status'] ?? 'pending');
        $where = [];
        if (in_array($status, ['pending', 'approved', 'rejected'], true)) $where[] = "r.status = '" . $status . "'";
        // People who can't approve only see their own requests
        $canApprove = $this->hasPermission('cancellations.approve', $u);
        $isAdmin = $this->isAdmin($u);
        $selfOk = $this->adminSelfApprove($u);
        if (!empty($_GET['mine']) || !$canApprove) $where[] = 'r.requested_by = ' . (int)$u['sub'];
        $this->db->query("
            SELECT r.*, ru.name AS requested_by_name, du.name AS decided_by_name, sl.name AS location_name
            FROM cancellation_requests r
            LEFT JOIN users ru ON ru.id = r.requested_by
            LEFT JOIN users du ON du.id = r.decided_by
            LEFT JOIN service_locations sl ON sl.id = r.location_id
            " . ($where ? 'WHERE ' . implode(' AND ', $where) : '') . "
            ORDER BY (r.status = 'pending') DESC, r.id DESC
            LIMIT 200
        ");
        $rows = $this->db->resultSet() ?: [];
        foreach ($rows as $r) {
            $r->can_decide = $canApprove && $r->status === 'pending' && ((int)$r->requested_by !== (int)$u['sub'] || $selfOk);
        }
        $this->db->query("SELECT COUNT(*) AS n FROM cancellation_requests WHERE status = 'pending'" . ($canApprove ? '' : ' AND requested_by = ' . (int)$u['sub']));
        $this->success(['requests' => $rows, 'pending' => (int)$this->db->single()->n, 'can_approve' => $canApprove, 'me' => (int)$u['sub'], 'is_admin' => $isAdmin, 'admin_self_approve' => $this->selfApproveSetting()]);
    }

    /** System setting: admins may approve their own cancellation requests (off by default). */
    private function selfApproveSetting() {
        $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'cancel_admin_self_approve' LIMIT 1");
        $row = $this->db->single();
        return $row && in_array(strtolower((string)$row->setting_value), ['1', 'true', 'yes', 'on'], true);
    }

    /** Only Admins get the self-approval exception, and only while the setting is on. */
    private function adminSelfApprove($u) {
        return $this->isAdmin($u) && $this->selfApproveSetting();
    }

    // POST /api/cancellation/self_approve { enabled } — Admin only
    public function self_approve() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Only an admin can change this', 403); return; }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        $on = !empty($this->body()['enabled']) ? '1' : '0';
        $this->db->query("INSERT INTO system_settings (setting_key, setting_value) VALUES ('cancel_admin_self_approve', :v)
                          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        $this->db->bind(':v', $on);
        $this->db->execute();
        $this->success(['admin_self_approve' => $on === '1'], $on === '1' ? 'Admins can now approve their own requests' : 'A second user must approve every request');
    }

    private function loadPending($id) {
        $this->db->query("SELECT * FROM cancellation_requests WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        $r = $this->db->single();
        if (!$r) { $this->error('Request not found', 404); return null; }
        if ($r->status !== 'pending') { $this->error('This request was already ' . $r->status, 409); return null; }
        return $r;
    }

    private function decide($r, $status, $note, $userId) {
        $this->db->query("UPDATE cancellation_requests SET status = :s, decided_by = :u, decided_at = NOW(), decision_note = :n WHERE id = :id AND status = 'pending'");
        $this->db->bind(':s', $status); $this->db->bind(':u', $userId);
        $this->db->bind(':n', $note !== '' ? mb_substr($note, 0, 500) : null); $this->db->bind(':id', $r->id);
        $this->db->execute();
    }

    // POST /api/cancellation/approve/{id} { note }  -> cancels the document
    public function approve($id = null) {
        $u = $this->requirePermission('cancellations.approve');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        $r = $this->loadPending($id); if (!$r) return;
        require_once '../app/helpers/Approval.php';
        if (($ar = Approval::forDocument('cancellation', (int)$r->id)) && $ar->status === 'Pending' && (int)$r->requested_by !== (int)$u['sub']) {
            $this->error('This request uses the approval workflow. Decide it in My Approvals.', 409); return;
        }
        if ((int)$r->requested_by === (int)$u['sub'] && !$this->adminSelfApprove($u)) { $this->error('You asked for this cancellation, so another user must approve it', 403); return; }
        $note = trim((string)($this->body()['note'] ?? ''));
        // Re-check: something may have changed since the request (e.g. a return was made)
        $block = CancellationRequestHelper::blocker($this->db, $r->doc_type, $r->doc_id);
        if ($block) { $this->error($block, 422); return; }
        $reason = $r->reason . ' (approved by user #' . (int)$u['sub'] . ($note !== '' ? ': ' . $note : '') . ')';
        [$ok, $msg] = CancellationRequestHelper::execute($r->doc_type, (int)$r->doc_id, $reason, (int)$u['sub']);
        if (!$ok) { $this->error($msg, 422); return; }
        $this->decide($r, 'approved', $note, (int)$u['sub']);
        $this->success(null, "{$r->doc_type} {$r->doc_no} cancelled");
    }

    // POST /api/cancellation/reject/{id} { note }
    public function reject($id = null) {
        $u = $this->requirePermission('cancellations.approve');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        $r = $this->loadPending($id); if (!$r) return;
        require_once '../app/helpers/Approval.php';
        if (($ar = Approval::forDocument('cancellation', (int)$r->id)) && $ar->status === 'Pending' && (int)$r->requested_by !== (int)$u['sub']) {
            $this->error('This request uses the approval workflow. Decide it in My Approvals.', 409); return;
        }
        $note = trim((string)($this->body()['note'] ?? ''));
        if ((int)$r->requested_by === (int)$u['sub']) {
            // withdrawing your own request is allowed
            $this->decide($r, 'rejected', $note !== '' ? $note : 'Withdrawn by requester', (int)$u['sub']);
            $this->success(null, 'Request withdrawn');
            return;
        }
        $this->decide($r, 'rejected', $note, (int)$u['sub']);
        $this->success(null, 'Request rejected');
    }

    // POST /api/cancellation/withdraw/{id}  (requester only)
    public function withdraw($id = null) {
        $u = $this->requireAuth();
        $r = $this->loadPending($id); if (!$r) return;
        if ((int)$r->requested_by !== (int)$u['sub']) { $this->error('Only the person who asked can withdraw it', 403); return; }
        $this->decide($r, 'rejected', 'Withdrawn by requester', (int)$u['sub']);
        $this->success(null, 'Request withdrawn');
    }

    public function history() {
        $this->requirePermission('accounting.write');
        
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        if ($page < 1) $page = 1;
        $offset = ($page - 1) * $limit;

        $subQueries = [
            "SELECT 'Invoice' as type, invoice_no as number, c.name as party, cancelled_at, cancellation_reason as reason FROM invoices i LEFT JOIN customers c ON i.customer_id = c.id WHERE i.status = 'Cancelled'",
            "SELECT 'GRN' as type, grn_number as number, s.name as party, cancelled_at, cancellation_reason as reason FROM goods_receive_notes g LEFT JOIN suppliers s ON g.supplier_id = s.id WHERE g.status = 'Cancelled'",
            "SELECT 'Expense' as type, voucher_no as number, payee_name as party, cancelled_at, cancellation_reason as reason FROM acc_expenses WHERE status = 'Cancelled'",
            "SELECT 'PaymentReceipt' as type, receipt_no as number, customer_name as party, cancelled_at, cancellation_reason as reason FROM payment_receipts WHERE status = 'Cancelled'",
            "SELECT 'VendorPayment' as type, reference_no as number, s.name as party, cancelled_at, cancellation_reason as reason FROM acc_supplier_payments p LEFT JOIN suppliers s ON p.supplier_id = s.id WHERE p.status = 'Cancelled'",
            "SELECT 'Reservation' as type, res.reservation_no as number, c.name as party, cancelled_at, cancellation_reason as reason FROM hotel_reservations res LEFT JOIN customers c ON res.customer_id = c.id WHERE res.status = 'Cancelled'"
        ];

        $combined = "(" . implode(") UNION ALL (", $subQueries) . ")";
        $sql = "$combined ORDER BY cancelled_at DESC LIMIT :limit OFFSET :offset";
        
        $this->db->query($sql);
        $this->db->bind(':limit', $limit);
        $this->db->bind(':offset', $offset);
        $results = $this->db->resultSet();

        // Total count
        $countSql = "SELECT COUNT(*) as total FROM ($combined) as t";
        $this->db->query($countSql);
        $total = $this->db->single()->total;

        $this->json([
            'status' => 'success', 
            'data' => $results,
            'pagination' => [
                'total' => (int)$total,
                'page' => $page,
                'limit' => $limit,
                'pages' => ceil($total / $limit)
            ]
        ]);
    }
}
