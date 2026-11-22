<?php
/**
 * StockAdjustmentController (batch adjustments - direct committed ledger viewer)
 *
 * Endpoints:
 * - GET  /api/stockadjustment/list?q=
 * - GET  /api/stockadjustment/get/{id}
 * - POST /api/stockadjustment/create
 */
class StockadjustmentController extends Controller {
    private $model;
    private $auditModel;

    public function __construct() {
        // InventorySchema::ensure();
        $this->model = $this->model('StockAdjustment');
        $this->auditModel = $this->model('AuditLog');
    }

    public function list() {
        $u = $this->requirePermission(['stock.read', 'stock.adjust', 'parts.write']);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $locId = $this->currentLocationId($u);
        $rows = $this->model->list($_GET['q'] ?? '', $locId);
        $this->success($rows);
    }

    public function get($id = null) {
        $u = $this->requirePermission(['stock.read', 'stock.adjust', 'parts.write']);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Adjustment ID required', 400);
        $locId = $this->currentLocationId($u);
        $row = $this->model->getById($id, $locId);
        if (!$row) $this->error('Not found', 404);
        $this->success($row);
    }

    public function create() {
        $u = $this->requirePermission(['stock.adjust', 'stock.read', 'parts.write']);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $locId = $this->currentLocationId($u);
        if (isset($_GET['location_id']) && (int)$_GET['location_id'] > 0) {
            $locId = (int)$_GET['location_id'];
        } elseif (isset($data['location_id']) && (int)$data['location_id'] > 0) {
            $locId = (int)$data['location_id'];
        }
        // Approval workflow: hold the adjustment; it is created (and stock changed) on the last approval.
        require_once '../app/helpers/Approval.php';
        if (Approval::isEnabled('stock_adjustment')) {
            [$value, $lines] = $this->estimateVariance($data, $locId);
            if (Approval::levelsFor('stock_adjustment', $value, $locId)) {
                if ($lines === 0) $this->error('Nothing to adjust: no line changes the stock.', 400);
                $r = Approval::submit('stock_adjustment', 0, [
                    'doc_no' => null, 'amount' => $value, 'location_id' => $locId,
                    'summary' => "Stock adjustment, $lines line(s)" . (!empty($data['reason']) ? ': ' . $data['reason'] : '')
                        . '; variance value LKR ' . number_format($value, 2),
                    'payload' => ['data' => $data, 'location_id' => $locId, 'user_id' => (int)$u['sub']],
                ], (int)$u['sub']);
                $this->success(['id' => null, 'approval' => 'Pending', 'request_id' => $r['request_id']],
                    'Adjustment sent for approval (' . $r['level'] . '). Stock changes when it is approved.');
            }
        }

        $res = $this->model->create($data, (int)$u['sub'], $locId);
        if (is_array($res) && isset($res['error'])) {
            $this->error($res['error'], 400);
        }
        if ($res) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'location_id' => $this->currentLocationId($u),
                'action' => 'create',
                'entity' => 'stock_adjustment',
                'entity_id' => (int)$res,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['line_count' => is_array($data['items'] ?? null) ? count($data['items']) : 0]),
            ]);
            $this->success(['id' => (int)$res], 'Adjustment created');
        }
        $this->error('Failed to create adjustment', 400);
    }

    /** [value of the stock change at cost, lines that change] for the approval amount limit. */
    private function estimateVariance(array $data, int $locId): array {
        $db = new Database();
        $value = 0.0; $lines = 0;
        foreach (($data['items'] ?? []) as $it) {
            $pid = (int)($it['part_id'] ?? $it['partId'] ?? 0);
            $bid = (int)($it['batch_id'] ?? $it['batchId'] ?? 0);
            $phys = $it['physical_stock'] ?? $it['physicalStock'] ?? null;
            if ($pid <= 0 || $phys === null || $phys === '') continue;
            if ($bid > 0) {
                $db->query("SELECT quantity_on_hand AS q FROM inventory_batches WHERE id = :b AND location_id = :l");
                $db->bind(':b', $bid);
            } else {
                $db->query("SELECT COALESCE(SUM(qty_change), 0) AS q FROM stock_movements WHERE part_id = :p AND location_id = :l AND batch_id IS NULL");
                $db->bind(':p', $pid);
            }
            $db->bind(':l', $locId);
            $sys = (float)($db->single()->q ?? 0);
            $diff = abs((float)$phys - $sys);
            if ($diff < 0.0005) continue;
            $db->query("SELECT COALESCE(cost_price, 0) FROM parts WHERE id = :p");
            $db->bind(':p', $pid);
            $value += $diff * (float)$db->singleColumn();
            $lines++;
        }
        return [round($value, 2), $lines];
    }
}
