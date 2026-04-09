<?php
/**
 * TaxController - Taxes master data
 *
 * Endpoints:
 * - GET    /api/tax/list?q=&all=1
 * - POST   /api/tax/create
 * - POST   /api/tax/update/{id}
 * - DELETE /api/tax/delete/{id}
 */
class TaxController extends Controller {
    private $taxModel;

    public function __construct() {
        TaxSchema::ensure();
        $this->taxModel = $this->model('Tax');
    }

    // GET /api/tax/list?q=&all=1
    public function list() {
        $this->requirePermission('taxes.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $q = $_GET['q'] ?? '';
        $activeOnly = !isset($_GET['all']) || (string)$_GET['all'] !== '1';
        $rows = $this->taxModel->list($q, $activeOnly);
        $this->success($rows);
    }

    // POST /api/tax/create
    public function create() {
        $u = $this->requirePermission('taxes.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if ($this->taxModel->create($data, (int)$u['sub'])) {
            $this->success(null, 'Tax created');
        }
        $this->error('Failed to create tax', 500);
    }

    // POST /api/tax/update/1
    public function update($id = null) {
        $u = $this->requirePermission('taxes.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Tax ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if ($this->taxModel->update($id, $data, (int)$u['sub'])) {
            $this->success(null, 'Tax updated');
        }
        $this->error('Failed to update tax', 500);
    }

    // DELETE /api/tax/delete/1
    public function delete($id = null) {
        $this->requirePermission('taxes.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Tax ID required', 400);
        if ($this->taxModel->delete($id)) {
            $this->success(null, 'Tax deleted');
        }
        $this->error('Failed to delete tax', 500);
    }
}

