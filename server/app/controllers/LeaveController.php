<?php
/**
 * LeaveController
 */
class LeaveController extends Controller {
    private $leaveModel;

    public function __construct() {
        $this->leaveModel = $this->model('Leave');
    }

    public function index() {
        $this->requests();
    }

    public function types() {
        $this->requirePermission('hrm.read');
        $this->success($this->leaveModel->listTypes());
    }

    public function requests() {
        $this->requirePermission('hrm.read');
        $status = $_GET['status'] ?? null;
        $eid = $_GET['employee_id'] ?? null;
        $rows = $this->leaveModel->listRequests($status, $eid);
        $this->success($rows);
    }

    public function create_request() {
        $this->requirePermission('leave.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        if ($this->leaveModel->createRequest($data)) {
            $this->success(null, 'Leave request submitted');
        }
        $this->error('Failed to submit leave request');
    }

    public function update_status() {
        $u = $this->requirePermission('leave.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        if (!isset($data['id']) || !isset($data['status'])) {
            $this->error('Request ID and Status required');
        }

        if ($this->leaveModel->updateStatus($data['id'], $data['status'], (int)$u['sub'])) {
            $this->success(null, 'Leave request status updated');
        }
        $this->error('Failed to update leave request status');
    }
}
