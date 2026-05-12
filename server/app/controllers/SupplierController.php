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
        $rows = $this->supplierModel->list($_GET['q'] ?? '', $_GET['type'] ?? null);
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
            'tax_reg_no' => isset($data['tax_reg_no']) ? trim((string)$data['tax_reg_no']) : null,
            'is_active' => $data['is_active'] ?? 1,
            'is_inventory_vendor' => $data['is_inventory_vendor'] ?? 1,
            'is_banquet_vendor' => $data['is_banquet_vendor'] ?? 0,
        ];

        $created = $this->supplierModel->create($payload, (int)$u['sub']);
        if ($created) {
            $sid = is_int($created) ? $created : null;
            if ($sid) {
                $taxIds = $data['tax_ids'] ?? null;
                if (is_array($taxIds)) {
                    $this->supplierModel->setTaxes($sid, $taxIds, (int)$u['sub']);
                }
            }
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'supplier',
                'entity_id' => $sid,
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
            'tax_reg_no' => isset($data['tax_reg_no']) ? trim((string)$data['tax_reg_no']) : null,
            'is_active' => $data['is_active'] ?? 1,
            'is_inventory_vendor' => $data['is_inventory_vendor'] ?? 1,
            'is_banquet_vendor' => $data['is_banquet_vendor'] ?? 0,
        ];

        if ($this->supplierModel->update($id, $payload, (int)$u['sub'])) {
            $taxIds = $data['tax_ids'] ?? null;
            if (is_array($taxIds)) {
                $this->supplierModel->setTaxes((int)$id, $taxIds, (int)$u['sub']);
            }
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

    // GET /api/supplier/payments
    public function payments() {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        require_once '../app/models/SupplierPayment.php';
        $paymentModel = new SupplierPayment();
        $rows = $paymentModel->list($_GET);
        $this->success($rows);
    }

    // GET /api/supplier/returns
    public function returns() {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        require_once '../app/models/PurchaseReturn.php';
        $returnModel = new PurchaseReturn();
        $rows = $returnModel->list($_GET);
        $this->success($rows);
    }

    // GET /api/supplier/summary/:id
    public function summary($id) {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $summary = $this->supplierModel->getPayableSummary($id);
        $this->success($summary);
    }

    // GET /api/supplier/payment_details/:id
    public function payment_details($id = null) {
        $this->requirePermission('suppliers.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Payment ID required', 400);
        
        require_once '../app/models/SupplierPayment.php';
        $paymentModel = new SupplierPayment();
        $row = $paymentModel->getById($id);
        
        if (!$row) $this->error('Payment not found', 404);
        $this->success($row);
    }
    // POST /api/supplier/cancel_payment/:id
    public function cancel_payment($id = null) {
        $u = $this->requirePermission('suppliers.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Payment ID required', 400);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $reason = $data['reason'] ?? 'Cancelled by user';

        require_once '../app/models/SupplierPayment.php';
        $paymentModel = new SupplierPayment();

        if ($paymentModel->cancel($id, $reason, (int)$u['sub'])) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'cancel',
                'entity' => 'supplier_payment',
                'entity_id' => (int)$id,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['reason' => $reason]),
            ]);
            $this->success(null, 'Payment cancelled');
        }
        $this->error('Failed to cancel payment', 500);
    }
}
