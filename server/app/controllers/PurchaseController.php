<?php
/**
 * PurchaseController - Purchase Orders CRUD
 */
class PurchaseController extends Controller {
    private $poModel;
    private $auditModel;

    public function __construct() {
        $this->poModel = $this->model('PurchaseOrder');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/purchase/list?q=
    public function list() {
        $u = $this->requirePermission('purchase.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $locId = $this->currentLocationId($u);
        $rows = $this->poModel->list($_GET['q'] ?? '', $locId);
        $this->success($rows);
    }

    // GET /api/purchase/get/1
    public function get($id = null) {
        $u = $this->requirePermission('purchase.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('PO ID required', 400);
        $locId = $this->currentLocationId($u);
        $row = $this->poModel->getById($id, $locId);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    // POST /api/purchase/create
    public function create() {
        $u = $this->requirePermission('purchase.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $locId = $this->currentLocationId($u);
        $poId = $this->poModel->create($data, (int)$u['sub'], $locId);
        if ($poId) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'purchase_order',
                'entity_id' => (int)$poId,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['supplier_id' => $data['supplier_id'] ?? null]),
            ]);
            $this->success(['id' => (int)$poId], 'Purchase order created');
        }
        $this->error('Failed to create purchase order', 400);
    }

    // POST /api/purchase/update/1
    public function update($id = null) {
        // Editing POs is restricted to Admin only (even if role has purchase.write).
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) $this->error('Forbidden', 403);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('PO ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $ok = $this->poModel->update($id, $data, (int)$u['sub']);
        if ($ok) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'update',
                'entity' => 'purchase_order',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => null,
            ]);
            $this->success(null, 'Purchase order updated');
        }
        $this->error('Update failed (PO may be Received/Cancelled)', 400);
    }

    // POST /api/purchase/set_status/1
    public function set_status($id = null) {
        // Status changes are restricted to Admin only.
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) $this->error('Forbidden', 403);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('PO ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $status = $data['status'] ?? null;
        if (!is_string($status) || trim($status) === '') $this->error('Status is required', 400);
        $ok = $this->poModel->setStatus($id, $status, (int)$u['sub']);
        if ($ok) $this->success(null, 'Status updated');
        $this->error('Failed to update status', 400);
    }
}
