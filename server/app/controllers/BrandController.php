<?php
/**
 * BrandController - Brands master data
 */
class BrandController extends Controller {
    private $brandModel;

    public function __construct() {
        BrandSchema::ensure();
        $this->brandModel = $this->model('Brand');
    }

    // GET /api/brand/list?q=
    public function list() {
        $this->requirePermission('brands.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $rows = $this->brandModel->list($_GET['q'] ?? '');
        $this->success($rows);
    }

    // POST /api/brand/create
    public function create() {
        $u = $this->requirePermission('brands.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);
        if ($this->brandModel->create($name, (int)$u['sub'])) {
            $this->success(null, 'Brand created');
        }
        $this->error('Failed to create brand', 500);
    }

    // POST /api/brand/update/1
    public function update($id = null) {
        $u = $this->requirePermission('brands.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Brand ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);
        if ($this->brandModel->update($id, $name, (int)$u['sub'])) {
            $this->success(null, 'Brand updated');
        }
        $this->error('Failed to update brand', 500);
    }

    // DELETE /api/brand/delete/1
    public function delete($id = null) {
        $this->requirePermission('brands.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Brand ID required', 400);
        if ($this->brandModel->delete($id)) {
            $this->success(null, 'Brand deleted');
        }
        $this->error('Failed to delete brand', 500);
    }
}

