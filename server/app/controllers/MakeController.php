<?php
/**
 * Make Controller (Vehicle Makes)
 */
class MakeController extends Controller {
    private $makeModel;
    private $auditModel;

    public function __construct() {
        $this->makeModel = $this->model('VehicleMake');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/make/list
    public function list() {
        $this->requirePermission('makes.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $this->success($this->makeModel->getAll());
    }

    // POST /api/make/create
    public function create() {
        $u = $this->requirePermission('makes.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Make name is required', 400);
            return;
        }

        $ok = $this->makeModel->create(['name' => trim($data['name'])], (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Make created');
        } else {
            $this->error('Failed to create make');
        }
    }

    // POST /api/make/update/{id}
    public function update($id = null) {
        $u = $this->requirePermission('makes.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Make ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Make name is required', 400);
            return;
        }

        $ok = $this->makeModel->update($id, ['name' => trim($data['name'])], (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Make updated');
        } else {
            $this->error('Failed to update make');
        }
    }

    // DELETE /api/make/delete/{id}
    public function delete($id = null) {
        $this->requirePermission('makes.write');
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method === 'POST') {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true);
            if (isset($data['_method']) && $data['_method'] === 'DELETE') {
                $method = 'DELETE';
            }
        }
        if ($method !== 'DELETE') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Make ID required', 400);
            return;
        }

        $ok = $this->makeModel->delete($id);
        if ($ok) {
            $this->success(null, 'Make deleted');
        } else {
            $this->error('Failed to delete make');
        }
    }
}
