<?php
/**
 * Technician Controller
 */

class TechnicianController extends Controller {
    private $technicianModel;
    private $auditModel;

    public function __construct() {
        $this->technicianModel = $this->model('Technician');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/technician/list
    public function list() {
        $this->requirePermission('technicians.read');
        if ($_SERVER['REQUEST_METHOD'] == 'GET') {
            $technicians = $this->technicianModel->getAll();
            $this->success($technicians);
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // POST /api/technician/create
    public function create() {
        $u = $this->requirePermission('technicians.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name'], $data['role'])) {
            $this->error('Missing required fields', 400);
            return;
        }
        $name = trim((string)$data['name']);
        $role = trim((string)$data['role']);
        if ($name === '' || $role === '') {
            $this->error('Name and role are required', 400);
            return;
        }

        $ok = $this->technicianModel->create(['name' => $name, 'role' => $role], (int)$u['sub']);
        if ($ok) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'create',
                'entity' => 'technician',
                'entity_id' => null,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['name' => $name, 'role' => $role]),
            ]);
            $this->success(null, 'Technician created');
        } else {
            $this->error('Failed to create technician');
        }
    }

    // POST /api/technician/update/{id}
    public function update($id = null) {
        $u = $this->requirePermission('technicians.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Technician ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name'], $data['role'])) {
            $this->error('Missing required fields', 400);
            return;
        }
        $name = trim((string)$data['name']);
        $role = trim((string)$data['role']);
        if ($name === '' || $role === '') {
            $this->error('Name and role are required', 400);
            return;
        }

        $ok = $this->technicianModel->update($id, ['name' => $name, 'role' => $role], (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Technician updated');
        } else {
            $this->error('Failed to update technician');
        }
    }

    // DELETE /api/technician/delete/{id}
    public function delete($id = null) {
        $u = $this->requirePermission('technicians.write');
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
            $this->error('Technician ID required', 400);
            return;
        }

        $ok = $this->technicianModel->delete($id);
        if ($ok) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'delete',
                'entity' => 'technician',
                'entity_id' => (int)$id,
                'method' => $method,
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => null,
            ]);
            $this->success(null, 'Technician deleted');
        } else {
            $this->error('Failed to delete technician');
        }
    }
}
