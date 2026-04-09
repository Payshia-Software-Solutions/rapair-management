<?php
/**
 * SupplierController
 */
class SupplierController extends Controller {
    private $supplierModel;
    private $auditModel;

    public function __construct() {
        $this->supplierModel = $this->model('Supplier');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/supplier/list?q=
    public function list() {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $rows = $this->supplierModel->list($_GET['q'] ?? '');
        $this->success($rows);
    }

    // GET /api/supplier/get/1
    public function get($id = null) {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Supplier ID required', 400);
        $row = $this->supplierModel->getById($id);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    // POST /api/supplier/create
    public function create() {
        $u = $this->requirePermission('suppliers.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);

        $payload = [
            'name' => $name,
            'email' => isset($data['email']) ? trim((string)$data['email']) : null,
            'phone' => isset($data['phone']) ? trim((string)$data['phone']) : null,
            'address' => isset($data['address']) ? trim((string)$data['address']) : null,
            'is_active' => $data['is_active'] ?? 1,
        ];

        if ($this->supplierModel->create($payload, (int)$u['sub'])) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'supplier',
                'entity_id' => null,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['name' => $name]),
            ]);
            $this->success(null, 'Supplier created');
        }
        $this->error('Failed to create supplier', 500);
    }

    // POST /api/supplier/update/1
    public function update($id = null) {
        $u = $this->requirePermission('suppliers.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Supplier ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);

        $payload = [
            'name' => $name,
            'email' => isset($data['email']) ? trim((string)$data['email']) : null,
            'phone' => isset($data['phone']) ? trim((string)$data['phone']) : null,
            'address' => isset($data['address']) ? trim((string)$data['address']) : null,
            'is_active' => $data['is_active'] ?? 1,
        ];

        if ($this->supplierModel->update($id, $payload, (int)$u['sub'])) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'update',
                'entity' => 'supplier',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['name' => $name]),
            ]);
            $this->success(null, 'Supplier updated');
        }
        $this->error('Failed to update supplier', 500);
    }

    // DELETE /api/supplier/delete/1
    public function delete($id = null) {
        $u = $this->requirePermission('suppliers.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Supplier ID required', 400);
        if ($this->supplierModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'delete',
                'entity' => 'supplier',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => null,
            ]);
            $this->success(null, 'Supplier deleted');
        }
        $this->error('Failed to delete supplier', 500);
    }
}

