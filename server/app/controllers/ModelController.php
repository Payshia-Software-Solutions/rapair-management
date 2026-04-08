<?php
/**
 * Model Controller (Vehicle Models)
 */
class ModelController extends Controller {
    private $modelModel;

    public function __construct() {
        $this->modelModel = $this->model('VehicleModel');
    }

    // GET /api/model/list[?make_id=1]
    public function list() {
        $this->requirePermission('models.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $makeId = isset($_GET['make_id']) ? (int) $_GET['make_id'] : null;
        if ($makeId === 0) {
            $makeId = null;
        }
        $this->success($this->modelModel->getAll($makeId));
    }

    // POST /api/model/create
    public function create() {
        $u = $this->requirePermission('models.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['make_id'], $data['name'])) {
            $this->error('Missing required fields', 400);
            return;
        }
        $makeId = (int) $data['make_id'];
        $name = trim((string) $data['name']);
        if ($makeId <= 0 || $name === '') {
            $this->error('Valid make and model name are required', 400);
            return;
        }

        $ok = $this->modelModel->create(['make_id' => $makeId, 'name' => $name], (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Model created');
        } else {
            $this->error('Failed to create model');
        }
    }

    // POST /api/model/update/{id}
    public function update($id = null) {
        $u = $this->requirePermission('models.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Model ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['make_id'], $data['name'])) {
            $this->error('Missing required fields', 400);
            return;
        }
        $makeId = (int) $data['make_id'];
        $name = trim((string) $data['name']);
        if ($makeId <= 0 || $name === '') {
            $this->error('Valid make and model name are required', 400);
            return;
        }

        $ok = $this->modelModel->update($id, ['make_id' => $makeId, 'name' => $name], (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Model updated');
        } else {
            $this->error('Failed to update model');
        }
    }

    // DELETE /api/model/delete/{id}
    public function delete($id = null) {
        $this->requirePermission('models.write');
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
            $this->error('Model ID required', 400);
            return;
        }

        $ok = $this->modelModel->delete($id);
        if ($ok) {
            $this->success(null, 'Model deleted');
        } else {
            $this->error('Failed to delete model');
        }
    }
}
