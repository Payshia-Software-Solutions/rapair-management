<?php
/**
 * CreditNoteController - customer credit notes (route /api/credit-note/...).
 *
 *   GET  /api/credit-note/list?q=&status=&customer_id=
 *   GET  /api/credit-note/details/{id}
 *   GET  /api/credit-note/open_invoices?customer_id=     unpaid invoices to apply credit to
 *   POST /api/credit-note/create      { customer_id, invoice_id?, cn_date?, reason, notes?, tax_amount?, items:[{description, amount}], apply_to_invoice? }
 *   POST /api/credit-note/apply/{id}  { invoice_id, amount }
 *   POST /api/credit-note/refund/{id} { amount, payment_method, reference_no? }
 *   POST /api/credit-note/cancel/{id} { reason }
 *
 * Reading needs credit_notes.read (or invoices.read); changes need credit_notes.write (or invoices.write).
 */
require_once __DIR__ . '/../helpers/CreditNoteHelper.php';

class CreditNoteController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
        CreditNoteHelper::ensure($this->db);
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    private function post() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return false; }
        return true;
    }

    private function audit($u, $action, $id, $details) {
        try {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'], 'action' => $action, 'entity' => 'credit_note', 'entity_id' => (int)$id,
                'method' => 'POST', 'path' => $_SERVER['REQUEST_URI'] ?? '', 'details' => json_encode($details),
            ]);
        } catch (Exception $e) { /* audit never blocks */ }
    }

    public function index() { $this->list(); }

    public function list() {
        $this->requirePermission(['credit_notes.read', 'invoices.read']);
        $this->success(CreditNoteHelper::listAll($this->db, [
            'q' => trim((string)($_GET['q'] ?? '')),
            'status' => $_GET['status'] ?? '',
            'customer_id' => $_GET['customer_id'] ?? '',
        ]));
    }

    public function details($id = null) {
        $this->requirePermission(['credit_notes.read', 'invoices.read']);
        $cn = $id ? CreditNoteHelper::detail($this->db, (int)$id) : null;
        if (!$cn) { $this->error('Credit note not found', 404); return; }
        $this->success($cn);
    }

    public function open_invoices() {
        $this->requirePermission(['credit_notes.read', 'invoices.read']);
        $c = (int)($_GET['customer_id'] ?? 0);
        if ($c <= 0) { $this->error('customer_id required', 422); return; }
        $this->success(CreditNoteHelper::openInvoices($this->db, $c, !empty($_GET['all'])));
    }

    public function create() {
        $u = $this->requirePermission(['credit_notes.write', 'invoices.write']);
        if (!$this->post()) return;
        $data = $this->body();
        try {
            $r = CreditNoteHelper::create($this->db, $data, (int)$u['sub']);
            $this->audit($u, 'create', $r['id'], ['cn_no' => $r['cn_no'], 'invoice_id' => $data['invoice_id'] ?? null]);
            $this->success($r, 'Credit note issued');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function apply($id = null) {
        $u = $this->requirePermission(['credit_notes.write', 'invoices.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            CreditNoteHelper::apply($this->db, (int)$id, (int)($d['invoice_id'] ?? 0), $d['amount'] ?? 0, (int)$u['sub']);
            $this->audit($u, 'apply', $id, $d);
            $this->success(CreditNoteHelper::detail($this->db, (int)$id), 'Credit applied');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function refund($id = null) {
        $u = $this->requirePermission(['credit_notes.write', 'invoices.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            CreditNoteHelper::refund($this->db, (int)$id, $d['amount'] ?? 0, $d['payment_method'] ?? '', $d['reference_no'] ?? '', (int)$u['sub']);
            $this->audit($u, 'refund', $id, $d);
            $this->success(CreditNoteHelper::detail($this->db, (int)$id), 'Refund recorded');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function cancel($id = null) {
        $u = $this->requirePermission(['credit_notes.write', 'invoices.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            CreditNoteHelper::cancel($this->db, (int)$id, $d['reason'] ?? '', (int)$u['sub']);
            $this->audit($u, 'cancel', $id, $d);
            $this->success(CreditNoteHelper::detail($this->db, (int)$id), 'Credit note cancelled');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }
}
