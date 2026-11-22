<?php
/**
 * StockcountController (physical stock counting / auditing)
 *
 * Endpoints:
 * - GET  /api/stockcount/list?q=&status=
 * - GET  /api/stockcount/get/{id}
 * - POST /api/stockcount/create
 * - POST /api/stockcount/approve/{id}
 * - POST /api/stockcount/reject/{id}
 */
class StockcountController extends Controller {
    private $model;
    private $auditModel;

    public function __construct() {
        // InventorySchema::ensure();
        $this->model = $this->model('StockCount');
        $this->auditModel = $this->model('AuditLog');
    }

    public function list() {
        $u = $this->requirePermission('stock.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $locId = $this->currentLocationId($u);
        $status = $_GET['status'] ?? null;
        $rows = $this->model->list($_GET['q'] ?? '', $locId, $status);
        $this->success($rows);
    }

    public function get($id = null) {
        $u = $this->requirePermission('stock.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Count ID required', 400);
        $locId = $this->currentLocationId($u);
        $row = $this->model->getById($id, $locId);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    public function create() {
        $u = $this->requirePermission('stock.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $locId = $this->currentLocationId($u);
        $res = $this->model->create($data, (int)$u['sub'], $locId);
        if (is_array($res) && isset($res['error'])) {
            $this->error($res['error'], 400);
        }
        if ($res) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'stock_count',
                'entity_id' => (int)$res,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['line_count' => is_array($data['items'] ?? null) ? count($data['items']) : 0]),
            ]);
            // Approval workflow: the count waits in My Approvals; the last approval applies it.
            require_once '../app/helpers/Approval.php';
            $approval = null;
            if (Approval::isEnabled('stock_count')) {
                $db = new Database();
                $db->query("SELECT sc.count_number, sc.location_id,
                                   COALESCE(SUM(ABS(i.variance) * COALESCE(p.cost_price, 0)), 0) AS value,
                                   COUNT(i.id) AS lines
                            FROM stock_counts sc
                            LEFT JOIN stock_count_items i ON i.stock_count_id = sc.id
                            LEFT JOIN parts p ON p.id = i.part_id
                            WHERE sc.id = :id GROUP BY sc.id");
                $db->bind(':id', (int)$res);
                $h = $db->single();
                $approval = Approval::submit('stock_count', (int)$res, [
                    'doc_no' => $h->count_number ?? null, 'amount' => (float)($h->value ?? 0), 'location_id' => (int)($h->location_id ?? 0),
                    'summary' => 'Stock count, ' . (int)($h->lines ?? 0) . ' line(s); variance value LKR ' . number_format((float)($h->value ?? 0), 2),
                ], (int)$u['sub']);
            }
            $this->success(['id' => (int)$res, 'approval' => $approval['status'] ?? null],
                ($approval && $approval['status'] === 'Pending') ? 'Stock count saved and sent for approval (' . $approval['level'] . ')' : 'Stock count sheet created');
        }
        $this->error('Failed to create stock count', 400);
    }

    public function approve($id = null) {
        $u = $this->requirePermission('stock.adjust');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Count ID required', 400);
        // With approvals on, counts are approved/rejected in My Approvals (which applies them).
        require_once '../app/helpers/Approval.php';
        if (Approval::isEnabled('stock_count') && ($ar = Approval::forDocument('stock_count', (int)$id)) && $ar->status === 'Pending') {
            $this->error('This count is waiting in My Approvals. Approve or reject it there.', 409);
        }
        $res = $this->model->approve($id, (int)$u['sub']);
        if (is_array($res) && isset($res['error'])) {
            $this->error($res['error'], 400);
        }
        if ($res) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'approve',
                'entity' => 'stock_count',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['status' => 'Approved']),
            ]);
            $this->success(null, 'Stock count approved and stock adjusted');
        }
        $this->error('Failed to approve stock count', 400);
    }

    public function reject($id = null) {
        $u = $this->requirePermission('stock.adjust');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Count ID required', 400);
        // With approvals on, counts are approved/rejected in My Approvals (which applies them).
        require_once '../app/helpers/Approval.php';
        if (Approval::isEnabled('stock_count') && ($ar = Approval::forDocument('stock_count', (int)$id)) && $ar->status === 'Pending') {
            $this->error('This count is waiting in My Approvals. Approve or reject it there.', 409);
        }
        $res = $this->model->reject($id, (int)$u['sub']);
        if (is_array($res) && isset($res['error'])) {
            $this->error($res['error'], 400);
        }
        if ($res) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'reject',
                'entity' => 'stock_count',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['status' => 'Rejected']),
            ]);
            $this->success(null, 'Stock count rejected');
        }
        $this->error('Failed to reject stock count', 400);
    }
}
