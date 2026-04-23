<?php
/**
 * PayrollController
 */
class PayrollController extends Controller {
    private $payrollModel;

    public function __construct() {
        $this->payrollModel = $this->model('Payroll');
    }

    public function index() {
        $this->list();
    }

    public function list() {
        $this->requirePermission('hrm.read');
        $month = $_GET['month'] ?? null;
        $year = $_GET['year'] ?? null;
        $rows = $this->payrollModel->list($month, $year);
        $this->success($rows);
    }

    public function generate() {
        $u = $this->requirePermission('payroll.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        if (!isset($data['employee_id']) || !isset($data['month']) || !isset($data['year'])) {
            $this->error('Employee ID, Month and Year required');
        }

        if ($this->payrollModel->generate($data['employee_id'], $data['month'], $data['year'], (int)$u['sub'])) {
            $this->success(null, 'Payroll generated');
        }
        $this->error('Failed to generate payroll');
    }

    public function update_status() {
        $this->requirePermission('payroll.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        if (!isset($data['id']) || !isset($data['status'])) {
            $this->error('Payroll ID and Status required');
        }

        if ($this->payrollModel->updateStatus($data['id'], $data['status'])) {
            $this->success(null, 'Payroll status updated');
        }
        $this->error('Failed to update payroll status');
    }
}
