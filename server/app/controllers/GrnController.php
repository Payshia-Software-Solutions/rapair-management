<?php
/**
 * GrnController - Goods Receive Notes
 */
class GrnController extends Controller {
    private $grnModel;
    private $auditModel;

    public function __construct() {
        $this->grnModel = $this->model('GoodsReceiveNote');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/grn/list?q=
    public function list() {
        $this->requirePermission('grn.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $rows = $this->grnModel->list($_GET['q'] ?? '');
        $this->success($rows);
    }

    // GET /api/grn/get/1
    public function get($id = null) {
        $this->requirePermission('grn.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('GRN ID required', 400);
        $row = $this->grnModel->getById($id);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    // POST /api/grn/create
    public function create() {
        $u = $this->requirePermission('grn.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $locId = $this->currentLocationId($u);
        $grnId = $this->grnModel->create($data, (int)$u['sub'], $locId);
        if ($grnId) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'grn',
                'entity_id' => (int)$grnId,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['supplier_id' => $data['supplier_id'] ?? null, 'purchase_order_id' => $data['purchase_order_id'] ?? null]),
            ]);
            $this->success(['id' => (int)$grnId], 'GRN created');
        }
        $this->error('Failed to create GRN', 400);
    }
}
