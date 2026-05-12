<?php
/**
 * ProductionOrderController
 */
class ProductionorderController extends Controller {
    private $orderModel;

    public function __construct() {
        $this->orderModel = $this->model('ProductionOrder');
    }

    public function list() {
        $this->requirePermission('production.read');
        $filters = [];
        if (isset($_GET['status'])) $filters['status'] = $_GET['status'];
        if (isset($_GET['location_id'])) $filters['location_id'] = (int)$_GET['location_id'];
        
        $rows = $this->orderModel->getAll($filters);
        $this->success($rows);
    }

    public function stats() {
        $this->requirePermission('production.read');
        $db = $this->orderModel->getDb();
        
        // Basic stats aggregation
        $db->query("SELECT status, COUNT(*) as count FROM production_orders GROUP BY status");
        $statusCounts = $db->resultSet();
        
        $db->query("SELECT COUNT(*) FROM production_boms WHERE is_active = 1");
        $activeBoms = $db->singleColumn();

        $this->success([
            'status_counts' => $statusCounts,
            'active_boms' => (int)$activeBoms
        ]);
    }

    public function get($id) {
        $this->requirePermission('production.read');
        $row = $this->orderModel->getById($id);
        if (!$row) $this->error('Production Order not found', 404);
        $this->success($row);
    }

    public function create() {
        $u = $this->requirePermission('production.write');
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        
        $locationModel = $this->model('ServiceLocation');
        $createdIds = [];

        // CASE 1: Consolidated Batch (New Format)
        if (isset($input['outputs']) && is_array($input['outputs'])) {
            if (empty($input['location_id'])) {
                $this->error('Location is required for production', 400);
            }

            $location = $locationModel->getById($input['location_id']);
            if (!$location || !$location->allow_production) {
                $this->error('Selected location does not allow production', 400);
            }

            try {
                $id = $this->orderModel->create($input, (int)$u['sub']);
                if ($id) {
                    $this->success([$id], 'Consolidated production batch created');
                }
            } catch (Exception $e) {
                $this->error($e->getMessage(), 400);
            }
            $this->error('Failed to create production batch', 400);
        }

        // CASE 2: Individual / Legacy Batch (Old Format)
        $orders = isset($input[0]) ? $input : [$input];
        foreach ($orders as $data) {
            if (empty($data['bom_id']) || empty($data['location_id']) || empty($data['qty'])) {
                continue;
            }

            // Check if location allows production
            $location = $locationModel->getById($data['location_id']);
            if (!$location || !$location->allow_production) {
                continue;
            }

            try {
                $id = $this->orderModel->create($data, (int)$u['sub']);
                if ($id) $createdIds[] = $id;
            } catch (Exception $e) {
                // For bulk, we might want to log or skip. 
                // But usually individual creates are handled one by one in UI.
            }
        }

        if (count($createdIds) > 0) {
            $this->success($createdIds, count($createdIds) . ' Production Order(s) created');
        }
        $this->error('Failed to create any Production Orders', 400);
    }

    /**
     * POST /api/production-order/start/1
     */
    public function start($id) {
        $u = $this->requirePermission('production.write');
        require_once '../app/helpers/AccountingHelper.php';
        require_once '../app/helpers/ProductionService.php';
        
        $result = ProductionService::startProduction($id, (int)$u['sub']);
        if ($result['success']) {
            $this->success(null, $result['message']);
        }
        $this->error($result['message'], 400);
    }

    /**
     * POST /api/production-order/complete/1
     */
    public function complete($id) {
        $u = $this->requirePermission('production.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        require_once '../app/helpers/AccountingHelper.php';
        require_once '../app/helpers/ProductionService.php';
        
        // Handle both single output yield (legacy) and multi-output yield arrays
        $outputs = isset($data['outputs']) ? $data['outputs'] : null;
        $actualYield = isset($data['actual_yield']) ? (float)$data['actual_yield'] : null;
        $wasteReason = isset($data['waste_reason']) ? $data['waste_reason'] : null;

        $result = ProductionService::completeProduction($id, (int)$u['sub'], $actualYield, $wasteReason, $outputs);
        if ($result['success']) {
            $this->success(null, $result['message']);
        }
        $this->error($result['message'], 400);
    }
}
