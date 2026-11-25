<?php
/**
 * GiftVoucherController - gift vouchers (route /api/gift-voucher/...).
 *
 *   GET  /api/gift-voucher/list?q=&status=     vouchers (Active / Expired / Redeemed / Void)
 *   GET  /api/gift-voucher/stats               outstanding liability, redeemed, counts
 *   GET  /api/gift-voucher/details/{id}        one voucher with its ledger
 *   GET  /api/gift-voucher/lookup?code=        POS: balance and whether it can pay
 *   POST /api/gift-voucher/issue               back office, free voucher { value, expires_at?, customer_id?, recipient_name?, recipient_phone?, message?, code? }
 *   POST /api/gift-voucher/sell                POS sale { ...same, payment_method: Cash|Card|Bank Transfer, location_id }
 *   POST /api/gift-voucher/void/{id}           { reason }
 *
 * Back office needs gift_vouchers.* (or promotions.*); the POS lookup and sale work with POS access.
 */
require_once __DIR__ . '/../helpers/GiftVoucherHelper.php';

class GiftVoucherController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
        GiftVoucherHelper::ensure($this->db);
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    public function list() {
        $this->requirePermission(['gift_vouchers.read', 'promotions.read']);
        $this->success(GiftVoucherHelper::listAll($this->db, [
            'q' => trim((string)($_GET['q'] ?? '')),
            'status' => $_GET['status'] ?? '',
        ]));
    }

    public function stats() {
        $this->requirePermission(['gift_vouchers.read', 'promotions.read']);
        $this->success(GiftVoucherHelper::stats($this->db));
    }

    public function details($id = null) {
        $this->requirePermission(['gift_vouchers.read', 'promotions.read', 'pos.read']);
        $id = $id ?: ($_GET['id'] ?? null);
        $v = $id ? GiftVoucherHelper::detail($this->db, (int)$id) : null;
        if (!$v) { $this->error('Voucher not found', 404); return; }
        $this->success($v);
    }

    public function lookup() {
        $this->requirePermission(['pos.read', 'pos.write', 'invoices.write', 'gift_vouchers.read', 'promotions.read']);
        $code = $_GET['code'] ?? '';
        if (GiftVoucherHelper::normalizeCode($code) === '') { $this->error('Enter the voucher code.', 422); return; }
        $v = GiftVoucherHelper::lookup($this->db, $code);
        if (!$v) { $this->error('Gift voucher not found. Check the code.', 404); return; }
        $this->success($v);
    }

    public function issue() {
        $u = $this->requirePermission(['gift_vouchers.write', 'promotions.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        try {
            $v = GiftVoucherHelper::create($this->db, $this->body(), 'Issued', (int)$u['sub']);
            $this->audit($u, 'issue', (int)$v->id, ['code' => $v->code, 'value' => $v->initial_value]);
            $this->success($v, 'Gift voucher issued');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function sell() {
        $u = $this->requirePermission(['pos.write', 'gift_vouchers.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $data = $this->body();
        if (empty($data['location_id'])) $data['location_id'] = $this->currentLocationId($u);
        try {
            $v = GiftVoucherHelper::create($this->db, $data, 'Sold', (int)$u['sub']);
            $this->audit($u, 'sell', (int)$v->id, ['code' => $v->code, 'value' => $v->initial_value, 'method' => $v->payment_method]);
            $this->success($v, 'Gift voucher sold');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    public function void($id = null) {
        $u = $this->requirePermission(['gift_vouchers.write', 'promotions.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        if (!$id) { $this->error('Voucher ID required', 400); return; }
        $data = $this->body();
        try {
            $left = GiftVoucherHelper::void($this->db, (int)$id, $data['reason'] ?? '', (int)$u['sub']);
            $this->audit($u, 'void', (int)$id, ['reason' => $data['reason'] ?? '', 'balance_reversed' => $left]);
            $this->success(['balance_reversed' => $left], 'Gift voucher voided');
        } catch (Exception $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    private function audit($u, $action, $id, array $details) {
        try {
            require_once __DIR__ . '/../models/AuditLog.php';
            (new AuditLog())->write([
                'user_id' => (int)$u['sub'],
                'action' => $action,
                'entity' => 'gift_voucher',
                'entity_id' => $id,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode($details),
            ]);
        } catch (Throwable $e) { /* audit is best effort */ }
    }
}
