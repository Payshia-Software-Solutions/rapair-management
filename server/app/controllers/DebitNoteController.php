<?php
/**
 * DebitNoteController - supplier debit notes (route /api/debit-note/...).
 *
 *   GET  /api/debit-note/list?q=&status=&supplier_id=
 *   GET  /api/debit-note/details/{id}
 *   GET  /api/debit-note/grns?supplier_id=&all=     GRNs with what is still owed (all=1: every GRN)
 *   POST /api/debit-note/create      { supplier_id, grn_id?, supplier_ref?, dn_date?, reason, notes?, tax_amount?, items:[{description, amount}], apply_to_grn? }
 *   POST /api/debit-note/apply/{id}  { grn_id, amount }
 *   POST /api/debit-note/refund/{id} { amount, payment_method, reference_no? }
 *   POST /api/debit-note/cancel/{id} { reason }
 *
 * Reading needs debit_notes.read (or suppliers.read); changes need debit_notes.write (or suppliers.write).
 */
require_once __DIR__ . '/../helpers/DebitNoteHelper.php';

class DebitNoteController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
        DebitNoteHelper::ensure($this->db);
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
                'user_id' => (int)$u['sub'], 'action' => $action, 'entity' => 'debit_note', 'entity_id' => (int)$id,
                'method' => 'POST', 'path' => $_SERVER['REQUEST_URI'] ?? '', 'details' => json_encode($details),
            ]);
        } catch (Exception $e) { /* audit never blocks */ }
    }

    public function index() { $this->list(); }

    public function list() {
        $this->requirePermission(['debit_notes.read', 'suppliers.read']);
        $this->success(DebitNoteHelper::listAll($this->db, [
            'q' => trim((string)($_GET['q'] ?? '')),
            'status' => $_GET['status'] ?? '',
            'supplier_id' => $_GET['supplier_id'] ?? '',
        ]));
    }

    public function details($id = null) {
        $this->requirePermission(['debit_notes.read', 'suppliers.read']);
        $cn = $id ? DebitNoteHelper::detail($this->db, (int)$id) : null;
        if (!$cn) { $this->error('Debit note not found', 404); return; }
        $this->success($cn);
    }

    public function grns() {
        $this->requirePermission(['debit_notes.read', 'suppliers.read']);
        $c = (int)($_GET['supplier_id'] ?? 0);
        if ($c <= 0) { $this->error('supplier_id required', 422); return; }
        $this->success(DebitNoteHelper::supplierGrns($this->db, $c, !empty($_GET['all'])));
    }

    public function create() {
        $u = $this->requirePermission(['debit_notes.write', 'suppliers.write']);
        if (!$this->post()) return;
        $data = $this->body();
        try {
            $r = DebitNoteHelper::create($this->db, $data, (int)$u['sub']);
            $this->audit($u, 'create', $r['id'], ['dn_no' => $r['dn_no'], 'grn_id' => $data['grn_id'] ?? null]);
            $this->success($r, 'Debit note issued');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function apply($id = null) {
        $u = $this->requirePermission(['debit_notes.write', 'suppliers.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            DebitNoteHelper::apply($this->db, (int)$id, (int)($d['grn_id'] ?? 0), $d['amount'] ?? 0, (int)$u['sub']);
            $this->audit($u, 'apply', $id, $d);
            $this->success(DebitNoteHelper::detail($this->db, (int)$id), 'Debit note applied');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function refund($id = null) {
        $u = $this->requirePermission(['debit_notes.write', 'suppliers.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            DebitNoteHelper::refund($this->db, (int)$id, $d['amount'] ?? 0, $d['payment_method'] ?? '', $d['reference_no'] ?? '', (int)$u['sub']);
            $this->audit($u, 'refund', $id, $d);
            $this->success(DebitNoteHelper::detail($this->db, (int)$id), 'Money received recorded');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function cancel($id = null) {
        $u = $this->requirePermission(['debit_notes.write', 'suppliers.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            DebitNoteHelper::cancel($this->db, (int)$id, $d['reason'] ?? '', (int)$u['sub']);
            $this->audit($u, 'cancel', $id, $d);
            $this->success(DebitNoteHelper::detail($this->db, (int)$id), 'Debit note cancelled');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }
}
