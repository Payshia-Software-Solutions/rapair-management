<?php
/**
 * HrdocumentController
 * Handles employee document uploads and management.
 */
class HrdocumentController extends Controller {
    private $docModel;

    public function __construct() {
        $this->docModel = $this->model('EmployeeDocument');
    }

    public function index() {
        $this->error('Employee ID required for Document Vault');
    }

    public function list($employeeId = null) {
        $this->requirePermission('hrm.read');
        if (!$employeeId) $this->error('Employee ID required');
        
        $rows = $this->docModel->list($employeeId);
        $this->success($rows);
    }

    public function upload() {
        $this->requirePermission('hrm.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $employeeId = (int)($_POST['employee_id'] ?? 0);
        $title = $_POST['title'] ?? 'Document';
        
        if (!$employeeId) $this->error('Employee ID required');
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $this->error('File upload failed or was empty');
        }

        $f = $_FILES['file'];
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        $allowed = ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'];
        
        if (!in_array($ext, $allowed)) {
            $this->error('Invalid file type. Only PDF, Images and Word docs allowed.');
        }

        $filename = 'doc_' . $employeeId . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dir = trim((string)CONTENT_DOCUMENTS_DIR, '/');

        try {
            $ftp = new FtpStorage();
            $ftp->upload($f['tmp_name'], $dir, $filename);
        } catch (Exception $e) {
            $this->error('FTP upload failed: ' . $e->getMessage(), 500);
        }

        $data = [
            'employee_id' => $employeeId,
            'title' => $title,
            'file_path' => $filename,
            'file_name' => $f['name'],
            'file_type' => $f['type']
        ];
        
        if ($this->docModel->create($data)) {
            $this->success([
                'filename' => $filename,
                'url' => rtrim(CONTENT_BASE_URL, '/') . '/' . $dir . '/' . $filename
            ], 'Document uploaded successfully');
        }

        $this->error('Failed to save document record');
    }

    public function delete($id = null) {
        $this->requirePermission('hrm.write');
        if (!$id) $this->error('ID required');

        $doc = $this->docModel->getById($id);
        if (!$doc) $this->error('Document not found', 404);

        if ($this->docModel->delete($id)) {
            // Delete actual file
            @unlink('../public/' . $doc->file_path);
            $this->success(null, 'Document deleted');
        }
        $this->error('Failed to delete document');
    }
}
