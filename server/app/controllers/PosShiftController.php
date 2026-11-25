<?php
/**
 * PosShiftController - cashier shifts (route /api/pos-shift/...).
 *
 *   GET  /api/pos-shift/current                 the signed-in cashier's open shift here (null if none), with live totals
 *   POST /api/pos-shift/open        { opening_float }
 *   POST /api/pos-shift/cash_move   { type: PayIn|PayOut, amount, reason }
 *   POST /api/pos-shift/close       { counted_cash, denominations?, notes? }  (notes required when the count is off)
 *   GET  /api/pos-shift/details/{id}
 *   GET  /api/pos-shift/list?from=&to=&location_id=all|id   back office: shifts with variance
 *
 *   GET  /api/pos-shift/terminals[?location_id=all|id]  terminals (with open shift); no param = current location (POS)
 *   POST /api/pos-shift/terminal_save   { id?, name, location_id }
 *   POST /api/pos-shift/terminal_delete { id }
 *
 * Location comes from X-Location-Id (the POS sends it), checked like everywhere else.
 * The POS PC's terminal comes from X-Terminal-Id; with it, the shift is the terminal's (drawer) shift.
 */
require_once __DIR__ . '/../helpers/PosShiftHelper.php';

class PosShiftController extends Controller {
    private $db;
    private $auditModel;

    public function __construct() {
        $this->db = new Database();
        $this->auditModel = $this->model('AuditLog');
        PosShiftHelper::ensure($this->db);
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
                'user_id' => (int)$u['sub'], 'action' => $action, 'entity' => 'pos_shift', 'entity_id' => (int)$id,
                'method' => 'POST', 'path' => $_SERVER['REQUEST_URI'] ?? '', 'details' => json_encode($details),
            ]);
        } catch (Throwable $e) { /* audit never blocks */ }
    }

    /** [locationId, terminalId|null] for this request. */
    private function scope($u) {
        $loc = $this->currentLocationId($u);
        $t = PosShiftHelper::requestTerminal($this->db, $loc);
        return [$loc, $t ? (int)$t->id : null];
    }

    public function current() {
        $u = $this->requirePermission(['pos.read', 'pos.write', 'pos.checkout']);
        [$loc, $tid] = $this->scope($u);
        $this->success(PosShiftHelper::current($this->db, (int)$u['sub'], $loc, $tid));
    }

    /** Locations this user may see: admin all, others their assigned ones (or token location). */
    private function allowedLocationIds($u) {
        if ($this->isAdmin($u)) {
            $this->db->query("SELECT id FROM service_locations");
            return array_map(function ($r) { return (int)$r->id; }, $this->db->resultSet());
        }
        $allowed = $u['allowed_location_ids'] ?? [];
        $ids = is_array($allowed) && $allowed ? array_map('intval', $allowed) : [];
        $ids[] = $this->currentLocationId($u);
        return array_values(array_unique($ids));
    }

    private function terminalOr404($id, $u) {
        $t = PosShiftHelper::terminal($this->db, (int)$id);
        if (!$t || !in_array((int)$t->location_id, $this->allowedLocationIds($u), true)) return null;
        return $t;
    }

    public function terminals() {
        $u = $this->requirePermission(['pos.read', 'pos.write', 'pos.checkout']);
        $loc = strtolower(trim((string)($_GET['location_id'] ?? '')));
        if ($loc === '') { // POS: this location only
            $this->success(PosShiftHelper::terminals($this->db, $this->currentLocationId($u)));
            return;
        }
        $ids = $this->allowedLocationIds($u);
        if ($loc !== 'all') $ids = in_array((int)$loc, $ids, true) ? [(int)$loc] : [];
        // Back office: with each terminal's open shift figures and today's sales.
        $this->success(PosShiftHelper::terminalsReport($this->db, $ids));
    }

    public function terminal_save() {
        $u = $this->requirePermission(['pos.write']);
        if (!$this->post()) return;
        $d = $this->body();
        $id = (int)($d['id'] ?? 0);
        $loc = (int)($d['location_id'] ?? 0);
        if ($loc <= 0) { $this->error('Choose a location.', 422); return; }
        if (!in_array($loc, $this->allowedLocationIds($u), true)) { $this->error('You cannot manage terminals at that location.', 403); return; }
        if ($id && !$this->terminalOr404($id, $u)) { $this->error('Terminal not found.', 404); return; }
        try {
            $this->success(PosShiftHelper::saveTerminal($this->db, $loc, $d['name'] ?? '', (int)$u['sub'], $id), 'Terminal saved');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function terminal_delete() {
        $u = $this->requirePermission(['pos.write']);
        if (!$this->post()) return;
        $d = $this->body();
        $t = $this->terminalOr404($d['id'] ?? 0, $u);
        if (!$t) { $this->error('Terminal not found.', 404); return; }
        try {
            PosShiftHelper::removeTerminal($this->db, (int)$t->id, (int)$t->location_id);
            $this->success(null, 'Terminal removed');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function open() {
        $u = $this->requirePermission(['pos.checkout', 'pos.write']);
        if (!$this->post()) return;
        $d = $this->body();
        try {
            [$loc, $tid] = $this->scope($u);
            $s = PosShiftHelper::open($this->db, (int)$u['sub'], $loc, $d['opening_float'] ?? 0, $tid);
            $this->audit($u, 'shift_open', $s->id, ['opening_float' => $s->opening_float]);
            $this->success($s, 'Shift opened');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function cash_move() {
        $u = $this->requirePermission(['pos.checkout', 'pos.write']);
        if (!$this->post()) return;
        $d = $this->body();
        [$loc, $tid] = $this->scope($u);
        $s = PosShiftHelper::current($this->db, (int)$u['sub'], $loc, $tid);
        if (!$s) { $this->error('Open a shift first.', 409); return; }
        try {
            PosShiftHelper::cashMove($this->db, $s, $d['type'] ?? '', $d['amount'] ?? 0, $d['reason'] ?? '', (int)$u['sub']);
            $this->audit($u, 'shift_cash_move', $s->id, $d);
            $this->success(PosShiftHelper::current($this->db, (int)$u['sub'], (int)$s->location_id, $tid), 'Saved');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function close() {
        $u = $this->requirePermission(['pos.checkout', 'pos.write']);
        if (!$this->post()) return;
        $d = $this->body();
        [$loc, $tid] = $this->scope($u);
        $s = PosShiftHelper::current($this->db, (int)$u['sub'], $loc, $tid);
        if (!$s) { $this->error('There is no open shift to close.', 409); return; }
        try {
            $r = PosShiftHelper::close($this->db, $s, $d['counted_cash'] ?? 0, $d['denominations'] ?? null, $d['notes'] ?? '', (int)$u['sub']);
            $this->audit($u, 'shift_close', $s->id, ['counted' => $r->counted_cash, 'expected' => $r->expected_cash, 'variance' => $r->variance]);
            $this->success($r, 'Shift closed');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function details($id = null) {
        $u = $this->requirePermission(['pos.read', 'reports.read']);
        $s = $id ? PosShiftHelper::detail($this->db, (int)$id) : null;
        if (!$s) { $this->error('Shift not found', 404); return; }
        // Cashiers see their own shifts; reports.read sees all
        if ((int)$s->user_id !== (int)$u['sub'] && !$this->isAdmin($u)) {
            $this->requirePermission('reports.read');
        }
        $this->success($s);
    }

    public function list() {
        $u = $this->requirePermission(['reports.read', 'accounting.read']);
        $from = $_GET['from'] ?? date('Y-m-d', strtotime('-6 days'));
        $to = $_GET['to'] ?? date('Y-m-d');
        $loc = strtolower(trim((string)($_GET['location_id'] ?? '')));
        if ($this->isAdmin($u) && ($loc === 'all' || $loc === '')) {
            $this->db->query("SELECT id FROM service_locations");
            $ids = array_map(function ($r) { return (int)$r->id; }, $this->db->resultSet());
        } elseif ($this->isAdmin($u)) {
            $ids = [(int)$loc];
        } else {
            $allowed = $u['allowed_location_ids'] ?? [];
            $ids = is_array($allowed) && $allowed ? array_map('intval', $allowed) : [$this->currentLocationId($u)];
            if ($loc !== '' && $loc !== 'all') $ids = in_array((int)$loc, $ids, true) ? [(int)$loc] : [];
        }
        $this->success(PosShiftHelper::listAll($this->db, $ids, $from, $to));
    }
}
