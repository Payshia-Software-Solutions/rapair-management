<?php
/**
 * PromotionController - promotional rules and cart validation.
 *
 *   GET  /api/promotion/active?location_id=   offers running right now (POS badges, offers list)
 *   GET  /api/promotion/list                  every promotion (admin), with live_now
 *   POST /api/promotion/validate              { items, location_id, order_type, bank_id?, card_category?, promo_code?, include_potential? }
 *                                             -> best-first matches (or { matches, potential } with include_potential)
 *   POST /api/promotion/check_code            { code, items, location_id, order_type, ... } -> the code's benefit or why not
 *   GET  /api/promotion/get?id=
 *   POST /api/promotion/save | toggle | delete
 */
class PromotionController extends Controller {
    private $promoModel;

    public function __construct() {
        $this->promoModel = $this->model('Promotion');
    }

    public function active() {
        $this->requirePermission(['promotions.read', 'pos.read', 'pos.write', 'orders.read', 'sales.read']);
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $this->success($this->promoModel->getActivePromotions($_GET['location_id'] ?? null));
    }

    public function list() {
        $this->requirePermission('promotions.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $this->success($this->promoModel->getAll());
    }

    private function cartInput() {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $items = isset($data['items']) ? json_decode(json_encode($data['items'])) : [];
        $ctx = [
            'promo_code' => $data['promo_code'] ?? null,
            'order_type' => $data['order_type'] ?? null,
            'include_potential' => !empty($data['include_potential']),
        ];
        return [$data, $items, $ctx];
    }

    public function validate() {
        $this->requirePermission(['pos.read', 'pos.write', 'promotions.read', 'orders.read', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        [$data, $items, $ctx] = $this->cartInput();

        if (empty($items)) {
            $this->success($ctx['include_potential'] ? ['matches' => [], 'potential' => []] : []);
            return;
        }
        $this->success($this->promoModel->findEligiblePromotions(
            $items, null, $data['bank_id'] ?? null, $data['card_category'] ?? null, $data['location_id'] ?? null, $ctx
        ));
    }

    public function check_code() {
        $this->requirePermission(['pos.read', 'pos.write', 'promotions.read', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        [$data, $items, $ctx] = $this->cartInput();
        $code = strtoupper(trim((string)($data['code'] ?? '')));
        if ($code === '') { $this->error('Enter a promo code.', 422); return; }

        $promo = $this->promoModel->findByCode($code);
        if (!$promo) { $this->error("Promo code {$code} was not found.", 404); return; }

        $ctx['promo_code'] = $code;
        $res = $this->promoModel->evaluate($promo->id, $items, $data['bank_id'] ?? null, $data['card_category'] ?? null, $data['location_id'] ?? null, $ctx);
        if (is_string($res)) { $this->error($res, 422); return; }
        $res->promo_code = $code;
        $this->success($res);
    }

    public function get() {
        $this->requirePermission('promotions.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $_GET['id'] ?? null;
        if (!$id) $this->error('ID Required');
        $promo = $this->promoModel->getPromotion($id);
        if (!$promo) $this->error('Promotion Not Found');
        $this->success($promo);
    }

    public function save() {
        $u = $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) $this->error('Promotion Name Required');
        if (empty($data['type'])) $this->error('Promotion Type Required');
        if (!empty($data['start_date']) && !empty($data['end_date']) && $data['end_date'] < $data['start_date']) {
            $this->error('End date is before the start date.', 422);
        }
        $data['userId'] = $u['sub'] ?? null;
        try {
            $id = $this->promoModel->savePromotion($data);
            $this->success(['id' => $id, 'message' => 'Promotion saved successfully']);
        } catch (Exception $e) {
            $this->error($e->getMessage());
        }
    }

    public function toggle() {
        $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = $data['id'] ?? null;
        if (!$id) $this->error('ID Required');
        if ($this->promoModel->toggleActive($id, $data['status'] ?? 0)) $this->success(['message' => 'Status updated']);
        else $this->error('Failed to update status');
    }

    public function delete() {
        $this->requirePermission('promotions.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = $data['id'] ?? null;
        if (!$id) $this->error('ID Required');
        if ($this->promoModel->deletePromotion($id)) $this->success(['message' => 'Promotion deleted successfully']);
        else $this->error('Failed to delete promotion');
    }
}
