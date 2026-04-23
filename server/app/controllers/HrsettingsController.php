<?php
/**
 * HrsettingsController
 */
class HrsettingsController extends Controller {
    private $deptModel;
    private $catModel;
    private $salaryItemModel;
    private $salaryTemplateModel;

    public function __construct() {
        require_once '../app/helpers/HRMSchema.php';
        HRMSchema::ensure();
        
        $this->deptModel = $this->model('HRDepartment');
        $this->catModel = $this->model('HRCategory');
        $this->salaryItemModel = $this->model('SalaryItem');
        $this->salaryTemplateModel = $this->model('SalaryTemplate');
    }

    public function index() {
        $this->departments();
    }

    public function departments() {
        $this->requirePermission('hrm.read');
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->requirePermission('hrm.write');
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            if ($this->deptModel->create($data)) {
                $this->success(null, 'Department created');
            }
            $this->error('Failed to create department');
        }
        $rows = $this->deptModel->list();
        $this->success($rows);
    }

    public function categories() {
        $this->requirePermission('hrm.read');
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->requirePermission('hrm.write');
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            if ($this->catModel->create($data)) {
                $this->success(null, 'Category created');
            }
            $this->error('Failed to create category');
        }
        $rows = $this->catModel->list();
        $this->success($rows);
    }

    public function salary_items() {
        $this->requirePermission('hrm.read');
        
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->requirePermission('hrm.write');
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            if ($this->salaryItemModel->create($data)) {
                $this->success(null, 'Salary item added');
            }
            $this->error('Failed to add salary item');
        }

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $this->requirePermission('hrm.write');
            $id = (int)($_GET['id'] ?? 0);
            if ($id && $this->salaryItemModel->delete($id)) {
                $this->success(null, 'Item removed');
            }
            $this->error('Failed to remove item');
        }

        $employeeId = (int)($_GET['employee_id'] ?? 0);
        if (!$employeeId) $this->error('Employee ID required');
        
        $rows = $this->salaryItemModel->listByEmployee($employeeId);
        $this->success($rows);
    }

    public function salary_templates() {
        $this->requirePermission('hrm.read');

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->requirePermission('hrm.write');
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            
            // Adding a new item to a template
            if (isset($data['template_id']) && isset($data['name'])) {
                if ($this->salaryTemplateModel->addItem($data)) {
                    $this->success(null, 'Item added to scheme');
                }
            } 
            // Creating a new template group
            else if (isset($data['name'])) {
                $id = $this->salaryTemplateModel->create($data['name']);
                if ($id) {
                    $this->success(['id' => $id], 'Scheme created');
                } else {
                    $this->error('Database error: Failed to create scheme. Check if name already exists.');
                }
            } else {
                $this->error('Missing required field: name');
            }
        }

        if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
            $this->requirePermission('hrm.write');
            $id = (int)($_GET['id'] ?? 0);
            $type = $_GET['type'] ?? 'scheme';

            if ($type === 'item') {
                if ($this->salaryTemplateModel->removeItem($id)) $this->success(null, 'Item removed');
            } else {
                if ($this->salaryTemplateModel->delete($id)) $this->success(null, 'Scheme deleted');
            }
            $this->error('Failed to delete');
        }

        $id = (int)($_GET['id'] ?? 0);
        if ($id) {
            $this->success($this->salaryTemplateModel->getWithItems($id));
        } else {
            $this->success($this->salaryTemplateModel->list());
        }
    }

    public function apply_template() {
        $this->requirePermission('hrm.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        $empId = (int)($data['employee_id'] ?? 0);
        $tempId = (int)($data['template_id'] ?? 0);
        
        if (!$empId || !$tempId) $this->error('Invalid parameters');
        
        require_once '../app/helpers/SalaryTemplateHelper.php';
        if (SalaryTemplateHelper::applyToEmployee($empId, $tempId)) {
            $this->success(null, 'Salary scheme applied successfully');
        }
        $this->error('Failed to apply scheme');
    }

    public function settings() {
        $this->requirePermission('hrm.read');
        $settingModel = $this->model('HRSetting');

        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $this->requirePermission('hrm.write');
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            foreach ($data as $k => $v) {
                $settingModel->update($k, $v);
            }
            $this->success(null, 'HR Settings updated');
        }

        $this->success($settingModel->getAll());
    }
}
