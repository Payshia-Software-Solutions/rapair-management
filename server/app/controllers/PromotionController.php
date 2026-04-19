<?php
/**
 * PromotionController - Handles promotional rules and cart validation.
 */
class PromotionController extends Controller {
    private $promoModel;

    public function __construct() {
        $this->promoModel = $this->model('Promotion');
    }

    /**
     * GET /api/promotion/active
     */
    public function active() {
        $this->requirePermission('promotions.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        
        $locationId = $_GET['location_id'] ?? null;
        $rows = $this->promoModel->getActivePromotions($locationId);
        $this->success($rows);
    }

    /**
     * POST /api/promotion/validate
     * Accepts: { items: [], subtotal: 0.00 }
     */
    public function validate() {
        $this->requirePermission('pos.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $items = isset($data['items']) ? json_decode(json_encode($data['items'])) : [];
        $subtotal = (float)($data['subtotal'] ?? 0);
        $bankId = $data['bank_id'] ?? null;
        $cardCategory = $data['card_category'] ?? null;
        $locationId = $data['location_id'] ?? null;

        if (empty($items)) {
            $this->success([]);
            return;
        }

        $matches = $this->promoModel->findEligiblePromotions($items, $subtotal, $bankId, $cardCategory, $locationId);
        $this->success($matches);
    }

    /**
     * GET /api/promotion/get?id=1
     */
    public function get() {
        $this->requirePermission('promotions.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        
        $id = $_GET['id'] ?? null;
        if (!$id) $this->error('ID Required');

        $promo = $this->promoModel->getPromotion($id);
        if (!$promo) $this->error('Promotion Not Found');
        
        $this->success($promo);
    }

    /**
     * POST /api/promotion/save
     */
    public function save() {
        $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) $this->error('Promotion Name Required');
        if (empty($data['type'])) $this->error('Promotion Type Required');

        try {
            $id = $this->promoModel->savePromotion($data);
            $this->success(['id' => $id, 'message' => 'Promotion saved successfully']);
        } catch (Exception $e) {
            $this->error($e->getMessage());
        }
    }

    /**
     * POST /api/promotion/toggle
     */
    public function toggle() {
        $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = $data['id'] ?? null;
        $status = $data['status'] ?? 0;

        if (!$id) $this->error('ID Required');

        if ($this->promoModel->toggleActive($id, $status)) {
            $this->success(['message' => 'Status updated']);
        } else {
            $this->error('Failed to update status');
        }
    }

    /**
     * POST /api/promotion/delete
     */
    public function delete() {
        $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = $data['id'] ?? null;

        if (!$id) $this->error('ID Required');

        if ($this->promoModel->deletePromotion($id)) {
            $this->success(['message' => 'Promotion deleted successfully']);
        } else {
            $this->error('Failed to delete promotion');
        }
    }
}
