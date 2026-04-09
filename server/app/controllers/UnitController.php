<?php
/**
 * UnitController - Units master data
 */
class UnitController extends Controller {
    private $unitModel;

    public function __construct() {
        UnitSchema::ensure();
        $this->unitModel = $this->model('Unit');
    }

    // GET /api/unit/list?q=
    public function list() {
        $this->requirePermission('units.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $rows = $this->unitModel->list($_GET['q'] ?? '');
        $this->success($rows);
    }

    // POST /api/unit/create
    public function create() {
        $u = $this->requirePermission('units.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);
        if ($this->unitModel->create($name, (int)$u['sub'])) {
            $this->success(null, 'Unit created');
        }
        $this->error('Failed to create unit', 500);
    }

    // POST /api/unit/update/1
    public function update($id = null) {
        $u = $this->requirePermission('units.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Unit ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') $this->error('Name is required', 400);
        if ($this->unitModel->update($id, $name, (int)$u['sub'])) {
            $this->success(null, 'Unit updated');
        }
        $this->error('Failed to update unit', 500);
    }

    // DELETE /api/unit/delete/1
    public function delete($id = null) {
        $this->requirePermission('units.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Unit ID required', 400);
        if ($this->unitModel->delete($id)) {
            $this->success(null, 'Unit deleted');
        }
        $this->error('Failed to delete unit', 500);
    }
}

