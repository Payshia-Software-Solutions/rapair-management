<?php
/**
 * Department Controller
 *
 * Endpoints:
 * - GET    /api/department/list
 * - POST   /api/department/create
 * - POST   /api/department/update/{id}
 * - DELETE /api/department/delete/{id}
 */
class DepartmentController extends Controller {
    private $deptModel;
    private $auditModel;

    public function __construct() {
        $this->deptModel = $this->model('Department');
        $this->auditModel = $this->model('AuditLog');
    }

    public function list() {
        $this->requirePermission('departments.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        // Departments are company-wide (not location-scoped).
        $rows = $this->deptModel->getAll();
        $this->success($rows);
    }

    public function create() {
        $u = $this->requirePermission('departments.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            $this->error('Name is required', 400);
            return;
        }
        $ok = $this->deptModel->create($data, (int)$u['sub']);
        if (!$ok) {
            $this->error('Failed to create department');
            return;
        }
        $this->auditModel->write([
            'user_id' => (int)$u['sub'],
            'location_id' => $this->currentLocationId($u),
            'action' => 'create',
            'entity' => 'department',
            'entity_id' => null,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['name' => $name]),
        ]);
        $this->success(null, 'Department created');
    }

    public function update($id = null) {
        $u = $this->requirePermission('departments.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Department ID required', 400);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            $this->error('Name is required', 400);
            return;
        }
        $ok = $this->deptModel->update((int)$id, $data, (int)$u['sub']);
        if (!$ok) {
            $this->error('Failed to update department');
            return;
        }
        $this->success(null, 'Department updated');
    }

    public function delete($id = null) {
        $u = $this->requirePermission('departments.write');
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
            $this->error('Department ID required', 400);
            return;
        }
        $ok = $this->deptModel->delete((int)$id);
        if (!$ok) {
            $this->error('Failed to delete department');
            return;
        }
        $this->success(null, 'Department deleted');
    }
}
