<?php
/**
 * Company Controller
 *
 * Endpoints:
 * - GET  /api/company/get
 * - POST /api/company/update
 */
class CompanyController extends Controller {
    private $companyModel;
    private $auditModel;

    public function __construct() {
        $this->companyModel = $this->model('Company');
        $this->auditModel = $this->model('AuditLog');
    }

    public function get() {
        $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $row = $this->companyModel->get();
        $this->success($row);
    }

    public function update() {
        $u = $this->requirePermission('company.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        
        // Transform tax_ids array to JSON if present
        if (isset($data['tax_ids']) && is_array($data['tax_ids'])) {
            $data['tax_ids_json'] = json_encode($data['tax_ids']);
        }

        $ok = $this->companyModel->update($data, (int)$u['sub']);
        if (!$ok) {
            $this->error('Failed to update company');
            return;
        }
        $this->auditModel->write([
            'user_id' => (int)$u['sub'],
            'location_id' => null,
            'action' => 'update',
            'entity' => 'company',
            'entity_id' => 1,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['name' => $name, 'tax_ids' => $data['tax_ids'] ?? null]),
        ]);
        $this->success(null, 'Company updated');
    }

    public function getTaxes() {
        $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $taxes = $this->companyModel->getTaxes(1);
        $this->success($taxes);
    }
}

