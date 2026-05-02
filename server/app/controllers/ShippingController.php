<?php
/**
 * Shipping Provider Controller
 */
class ShippingController extends Controller {
    private $shippingModel;
    private $costingModel;
    private $sheetModel;
    private $factorModel;
    private $categoryModel;
    private $auditModel;
    private $packingModel;

    public function __construct() {
        $this->shippingModel = $this->model('ShippingProvider');
        $this->costingModel = $this->model('ShippingCostingTemplate');
        $this->sheetModel = $this->model('ShippingCostingSheet');
        $this->factorModel = $this->model('LogisticsFactor');
        $this->categoryModel = $this->model('LogisticsCategory');
        $this->auditModel = $this->model('AuditLog');
        $this->packingModel = $this->model('ShippingPackingModel');
    }

    // --- Providers ---
    // GET /api/shipping/providers
    public function providers() {
        $activeOnly = !isset($_GET['all']);
        $providers = $this->shippingModel->list($activeOnly);
        $this->success($providers);
    }

    // POST /api/shipping/providers/create
    public function create() {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->shippingModel->create($data, $u['sub']);
        if ($id) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'create',
                'entity' => 'shipping_provider',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success(['id' => $id], 'Shipping provider created');
        } else {
            $this->error('Failed to create shipping provider');
        }
    }

    // POST /api/shipping/providers/update/:id
    public function update($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->shippingModel->update($id, $data, $u['sub'])) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'update',
                'entity' => 'shipping_provider',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success([], 'Shipping provider updated');
        } else {
            $this->error('Failed to update shipping provider');
        }
    }

    // POST /api/shipping/providers/delete/:id
    public function delete($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($this->shippingModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'delete',
                'entity' => 'shipping_provider',
                'entity_id' => $id
            ]);
            $this->success([], 'Shipping provider deleted');
        } else {
            $this->error('Failed to delete shipping provider');
        }
    }

    // GET /api/shipping/templates
    public function templates($action = null, $id = null) {
        if ($action === 'create') return $this->template_create();
        if ($action === 'view') return $this->template_view($id);
        if ($action === 'update') return $this->template_update($id);
        if ($action === 'delete') return $this->template_delete($id);

        $activeOnly = !isset($_GET['all']);
        $templates = $this->costingModel->list($activeOnly);
        $this->success($templates);
    }

    // GET /api/shipping/templates/view/:id
    private function template_view($id) {
        $template = $this->costingModel->getById($id);
        if ($template) {
            $this->success($template);
        } else {
            $this->error('Template not found', 404);
        }
    }

    // POST /api/shipping/templates/create
    private function template_create() {
        $u = $this->requirePermission('costing.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->costingModel->create($data, $u['sub']);
        if ($id) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'create',
                'entity' => 'shipping_costing_template',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success(['id' => $id], 'Costing template created');
        } else {
            $this->error('Failed to create costing template');
        }
    }

    // POST /api/shipping/templates/update/:id
    private function template_update($id) {
        $u = $this->requirePermission('costing.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->costingModel->update($id, $data, $u['sub'])) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'update',
                'entity' => 'shipping_costing_template',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success([], 'Costing template updated');
        } else {
            $this->error('Failed to update costing template');
        }
    }

    // POST /api/shipping/templates/delete/:id
    private function template_delete($id) {
        $u = $this->requirePermission('costing.manage');
        if ($this->costingModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'delete',
                'entity' => 'shipping_costing_template',
                'entity_id' => $id
            ]);
            $this->success([], 'Costing template deleted');
        } else {
            $this->error('Failed to delete costing template');
        }
    }

    // GET /api/shipping/sheets
    public function sheets($action = null, $id = null) {
        if ($action === 'create') return $this->sheet_create();
        if ($action === 'view') return $this->sheet_view($id);
        if ($action === 'update') return $this->sheet_update($id);
        if ($action === 'delete') return $this->sheet_delete($id);
        if ($action === 'duplicate') return $this->sheet_duplicate($id);
        if ($action === 'bulk-delete') return $this->sheet_bulk_delete();

        $customerId = $_GET['customer_id'] ?? null;
        $sheets = $this->sheetModel->list($customerId);
        $this->success($sheets);
    }

    // GET /api/shipping/sheets/view/:id
    private function sheet_view($id) {
        $sheet = $this->sheetModel->getById($id);
        if ($sheet) {
            $this->success($sheet);
        } else {
            $this->error('Costing sheet not found', 404);
        }
    }

    // POST /api/shipping/sheets/create
    private function sheet_create() {
        $u = $this->requirePermission('costing.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) $this->error('Invalid input', 400);

        $id = $this->sheetModel->create($data, $u['sub']);
        if ($id) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'create',
                'entity' => 'shipping_costing_sheet',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success(['id' => $id], 'Costing sheet created');
        } else {
            $this->error('Failed to create costing sheet');
        }
    }

    // POST /api/shipping/sheets/update/:id
    private function sheet_update($id) {
        $u = $this->requirePermission('costing.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) $this->error('Invalid input', 400);

        if ($this->sheetModel->update($id, $data, $u['sub'])) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'update',
                'entity' => 'shipping_costing_sheet',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success([], 'Costing sheet updated');
        } else {
            $this->error('Failed to update costing sheet');
        }
    }

    // POST /api/shipping/sheets/delete/:id
    private function sheet_delete($id) {
        $u = $this->requirePermission('costing.manage');
        if ($this->sheetModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'delete',
                'entity' => 'shipping_costing_sheet',
                'entity_id' => $id
            ]);
            $this->success([], 'Costing sheet deleted');
        } else {
            $this->error('Failed to delete costing sheet');
        }
    }

    private function sheet_bulk_delete() {
        $u = $this->requirePermission('costing.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || !isset($data['ids']) || !is_array($data['ids'])) {
            $this->error('Invalid input', 400);
        }

        if (empty($data['ids'])) {
            $this->success([], 'No items to delete');
        }

        if ($this->sheetModel->deleteBulk($data['ids'])) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'bulk_delete',
                'entity' => 'shipping_costing_sheet',
                'entity_id' => null,
                'details' => json_encode(['ids' => $data['ids']])
            ]);
            $this->success([], count($data['ids']) . ' costing sheets deleted');
        } else {
            $this->error('Failed to delete costing sheets');
        }
    }

    private function sheet_duplicate($id) {
        try {
            $u = $this->requirePermission('costing.manage');
            $newId = $this->sheetModel->duplicate($id, $u['sub']);
            if ($newId) {
                $this->auditModel->write([
                    'user_id' => $u['sub'],
                    'action' => 'duplicate',
                    'entity' => 'shipping_costing_sheet',
                    'entity_id' => $newId,
                    'details' => json_encode(['original_id' => $id])
                ]);
                $this->success(['id' => $newId], 'Costing sheet duplicated');
            } else {
                $this->error('Failed to duplicate costing sheet. Check server logs.');
            }
        } catch (Throwable $e) {
            error_log("ShippingController::sheet_duplicate ERROR: " . $e->getMessage());
            $this->error('Server Error during duplication: ' . $e->getMessage(), 500);
        }
    }

    // --- Logistics Factors ---
    // GET /api/shipping/factors
    public function factors() {
        $activeOnly = !isset($_GET['all']);
        $factors = $this->factorModel->list($activeOnly);
        $this->success($factors);
    }

    // POST /api/shipping/factors/create
    public function factor_create() {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->factorModel->create($data);
        if ($id) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'create',
                'entity' => 'logistics_factor',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success(['id' => $id], 'Logistics factor created');
        } else {
            $this->error('Failed to create logistics factor');
        }
    }

    // POST /api/shipping/factors/update/:id
    public function factor_update($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->factorModel->update($id, $data)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'update',
                'entity' => 'logistics_factor',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success([], 'Logistics factor updated');
        } else {
            $this->error('Failed to update logistics factor');
        }
    }

    // POST /api/shipping/factors/delete/:id
    public function factor_delete($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($this->factorModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'delete',
                'entity' => 'logistics_factor',
                'entity_id' => $id
            ]);
            $this->success([], 'Logistics factor deleted');
        } else {
            $this->error('Failed to delete logistics factor');
        }
    }

    // --- Logistics Categories ---
    // GET /api/shipping/categories
    public function categories() {
        $categories = $this->categoryModel->list();
        $this->success($categories);
    }

    // POST /api/shipping/categories/create
    public function category_create() {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->categoryModel->create($data);
        if ($id) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'create',
                'entity' => 'logistics_category',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success(['id' => $id], 'Category created');
        } else {
            $this->error('Failed to create category');
        }
    }

    // POST /api/shipping/categories/update/:id
    public function category_update($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->categoryModel->update($id, $data)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'update',
                'entity' => 'logistics_category',
                'entity_id' => $id,
                'details' => json_encode($data)
            ]);
            $this->success([], 'Category updated');
        } else {
            $this->error('Failed to update category');
        }
    }

    // POST /api/shipping/categories/delete/:id
    public function category_delete($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($this->categoryModel->delete($id)) {
            $this->auditModel->write([
                'user_id' => $u['sub'],
                'action' => 'delete',
                'entity' => 'logistics_category',
                'entity_id' => $id
            ]);
            $this->success([], 'Category deleted');
        } else {
            $this->error('Failed to delete category');
        }
    }

    // GET /api/shipping/term-defaults/:term
    public function term_defaults($term) {
        $defaults = $this->factorModel->getTermDefaults($term);
        $this->success($defaults);
    }

    // --- Export Packing & Equipment ---
    // GET/POST /api/shipping/packing_packaging/:action/:id
    public function packing_packaging($action = null, $id = null) {
        if ($action === 'create') return $this->packing_packaging_create();
        if ($action === 'update') return $this->packing_packaging_update($id);
        if ($action === 'delete') return $this->packing_packaging_delete($id);
        $this->success($this->packingModel->getPackaging());
    }

    // GET/POST /api/shipping/packing_pallets/:action/:id
    public function packing_pallets($action = null, $id = null) {
        if ($action === 'create') return $this->packing_pallets_create();
        if ($action === 'update') return $this->packing_pallets_update($id);
        if ($action === 'delete') return $this->packing_pallets_delete($id);
        $this->success($this->packingModel->getPallets());
    }

    // GET /api/shipping/packing/containers
    public function packing_containers() {
        $this->success($this->packingModel->getContainers());
    }

    // POST /api/shipping/packing_packaging/create
    private function packing_packaging_create() {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->packingModel->createPackaging($data);
        if ($id) {
            $this->success(['id' => $id], 'Packaging type created');
        } else {
            $this->error('Failed to create packaging type');
        }
    }

    // POST /api/shipping/packing_packaging/delete/:id
    private function packing_packaging_delete($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($this->packingModel->deletePackaging($id)) {
            $this->success([], 'Packaging type deleted');
        } else {
            $this->error('Failed to delete packaging type');
        }
    }

    // POST /api/shipping/packing_packaging/update/:id
    private function packing_packaging_update($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->packingModel->updatePackaging($id, $data)) {
            $this->success([], 'Packaging type updated');
        } else {
            $this->error('Failed to update packaging type');
        }
    }

    // Pallets
    // POST /api/shipping/packing_pallets/create
    private function packing_pallets_create() {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        $id = $this->packingModel->createPallet($data);
        if ($id) {
            $this->success(['id' => $id], 'Pallet type created');
        } else {
            $this->error('Failed to create pallet type');
        }
    }

    // POST /api/shipping/packing_pallets/update/:id
    private function packing_pallets_update($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data || empty($data['name'])) $this->error('Invalid input', 400);

        if ($this->packingModel->updatePallet($id, $data)) {
            $this->success([], 'Pallet type updated');
        } else {
            $this->error('Failed to update pallet type');
        }
    }

    // POST /api/shipping/packing_pallets/delete/:id
    private function packing_pallets_delete($id) {
        $u = $this->requirePermission('shipping.manage');
        if ($this->packingModel->deletePallet($id)) {
            $this->success([], 'Pallet type deleted');
        } else {
            $this->error('Failed to delete pallet type');
        }
    }
}
