<?php
/**
 * Bay Controller
 */

class BayController extends Controller {
    private $bayModel;
    private $auditModel;

    public function __construct() {
        $this->bayModel = $this->model('ServiceBay');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/bay/list
    public function list() {
        $this->requirePermission('bays.read');
        if ($_SERVER['REQUEST_METHOD'] == 'GET') {
            $bays = $this->bayModel->getAll();
            $this->success($bays);
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // POST /api/bay/create
    public function create() {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Bay name is required', 400);
            return;
        }

        $ok = $this->bayModel->create(trim($data['name']), (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Bay created');
        } else {
            $this->error('Create failed');
        }
    }

    // POST /api/bay/update/1
    public function update($id = null) {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Bay ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Bay name is required', 400);
            return;
        }

        $ok = $this->bayModel->update($id, trim($data['name']), (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Bay updated');
        } else {
            $this->error('Update failed');
        }
    }

    // DELETE /api/bay/delete/1
    public function delete($id = null) {
        $this->requirePermission('bays.write');
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
            $this->error('Bay ID required', 400);
            return;
        }

        $ok = $this->bayModel->delete($id);
        if ($ok) {
            $this->success(null, 'Bay deleted');
        } else {
            $this->error('Delete failed');
        }
    }

    // POST /api/bay/update_status/1
    public function update_status($id = null) {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {
            $raw_data = file_get_contents('php://input');
            $data = json_decode($raw_data, true);

            if (!$id || !isset($data['status'])) {
                $this->error('Missing required data', 400);
            }

            if ($this->bayModel->updateStatus($id, $data['status'], (int)$u['sub'])) {
                $this->success(['id' => $id, 'status' => $data['status']], 'Bay status updated');
            } else {
                $this->error('Update failed');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }
}
