<?php
/**
 * Category Controller (Repair Categories)
 */
class CategoryController extends Controller {
    private $categoryModel;
    private $auditModel;

    public function __construct() {
        $this->categoryModel = $this->model('RepairCategory');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/category/list
    public function list() {
        $this->requirePermission('categories.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $this->success($this->categoryModel->getAll());
    }

    // POST /api/category/create
    public function create() {
        $u = $this->requirePermission('categories.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            $this->error('Category name is required', 400);
            return;
        }
        $ok = $this->categoryModel->create($name, (int)$u['sub']);
        if ($ok) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'create',
                'entity' => 'repair_category',
                'entity_id' => null,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['name' => $name]),
            ]);
            $this->success(null, 'Category created');
        } else {
            $this->error('Failed to create category');
        }
    }

    // POST /api/category/update/{id}
    public function update($id = null) {
        $u = $this->requirePermission('categories.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Category ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $name = trim((string)($data['name'] ?? ''));
        if ($name === '') {
            $this->error('Category name is required', 400);
            return;
        }
        $ok = $this->categoryModel->update($id, $name, (int)$u['sub']);
        if ($ok) {
            $this->success(null, 'Category updated');
        } else {
            $this->error('Failed to update category');
        }
    }

    // DELETE /api/category/delete/{id}
    public function delete($id = null) {
        $u = $this->requirePermission('categories.write');
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
            $this->error('Category ID required', 400);
            return;
        }
        $ok = $this->categoryModel->delete($id);
        if ($ok) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'delete',
                'entity' => 'repair_category',
                'entity_id' => (int)$id,
                'method' => $method,
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => null,
            ]);
            $this->success(null, 'Category deleted');
        } else {
            $this->error('Failed to delete category');
        }
    }
}

