<?php
/**
 * EmployeeController
 */
class EmployeeController extends Controller {
    private $employeeModel;

    public function __construct() {
        SaasHelper::requireModule('hrm');
        $this->employeeModel = $this->model('Employee');
    }

    public function index() {
        $this->list();
    }

    public function list() {
        $this->requirePermission('hrm.read');
        $q = $_GET['q'] ?? '';
        $rows = $this->employeeModel->list($q);
        $this->success($rows);
    }

    public function get($id = null) {
        $this->requirePermission('hrm.read');
        if (!$id) $this->error('ID required');
        $row = $this->employeeModel->getById($id);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    public function create() {
        $u = $this->requirePermission('hrm.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        
        $id = $this->employeeModel->create($data, (int)$u['sub']);
        if ($id) {
            $this->success(['id' => $id], 'Employee created');
        }
        $this->error('Failed to create employee');
    }

    public function update($id = null) {
        $u = $this->requirePermission('hrm.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'PUT') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('ID required');
        
        $data = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        if ($this->employeeModel->update($id, $data, (int)$u['sub'])) {
            $this->success(null, 'Employee updated');
        }
        $this->error('Failed to update employee');
    }

    public function delete($id = null) {
        $this->requirePermission('hrm.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('ID required');
        
        if ($this->employeeModel->delete($id)) {
            $this->success(null, 'Employee deleted');
        }
        $this->error('Failed to delete employee');
    }

    public function upload_avatar() {
        $this->requirePermission('hrm.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $id = (int)($_POST['employee_id'] ?? 0);
        if (!$id) $this->error('Employee ID required');
        
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $this->error('File upload failed or was empty');
        }

        $f = $_FILES['file'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp'];
        
        if (!in_array($ext, $allowed)) {
            $this->error('Invalid file type. Only JPG, PNG and WEBP allowed.');
        }

        $filename = 'avatar_' . $id . '_' . time() . '.' . $ext;
        $dir = trim((string)CONTENT_EMPLOYEES_DIR, '/');

        try {
            $ftp = new FtpStorage();
            $ftp->upload($f['tmp_name'], $dir, $filename);
        } catch (Exception $e) {
            $this->error('FTP upload failed: ' . $e->getMessage(), 500);
        }

        if ($this->employeeModel->updateAvatar($id, $filename)) {
            $this->success([
                'filename' => $filename,
                'url' => rtrim(CONTENT_BASE_URL, '/') . '/' . $dir . '/' . $filename
            ], 'Avatar updated successfully');
        }

        $this->error('Database update failed');
    }

    public function generate_code() {
        $this->requirePermission('hrm.read');
        $deptId = (int)($_GET['department_id'] ?? 0);
        $catId = (int)($_GET['category_id'] ?? 0);
        
        if (!$deptId || !$catId) {
            $this->error('Department and Category ID required');
        }
        
        $code = $this->employeeModel->generateNextCode($deptId, $catId);
        $this->success(['code' => $code]);
    }
}
