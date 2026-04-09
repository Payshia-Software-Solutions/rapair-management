<?php
/**
 * Stock Transfer Controller
 * Endpoints:
 * - GET  /api/stocktransfer/list
 * - GET  /api/stocktransfer/get/{id}
 * - POST /api/stocktransfer/create
 * - POST /api/stocktransfer/receive/{id}
 */
class StocktransferController extends Controller {
    private $model;
    private $audit;

    public function __construct() {
        $this->model = $this->model('StockTransfer');
        $this->audit = $this->model('AuditLog');
    }

    private function allowedLocationIds($u) {
        if ($this->isAdmin($u)) {
            $db = new Database();
            $db->query("SELECT id FROM service_locations ORDER BY id ASC");
            $rows = $db->resultSet() ?: [];
            return array_map(function($r) { return (int)$r->id; }, $rows);
        }
        $ids = $u['allowed_location_ids'] ?? null;
        $out = [];
        if (is_array($ids)) {
            foreach ($ids as $id) {
                $id = (int)$id;
                if ($id > 0) $out[] = $id;
            }
        }
        if (count($out) === 0) {
            $out = [isset($u['location_id']) ? (int)$u['location_id'] : 1];
        }
        return array_values(array_unique($out));
    }

    public function list() {
        $u = $this->requirePermission('transfer.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $ids = $this->allowedLocationIds($u);
        $rows = $this->model->listByLocations($ids);
        $this->success($rows);
    }

    public function get($id = null) {
        $u = $this->requirePermission('transfer.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) $this->error('Transfer ID required', 400);
        $res = $this->model->getById((int)$id);
        if (!$res) $this->error('Transfer not found', 404);
        $this->success($res);
    }

    public function create() {
        $u = $this->requirePermission('transfer.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $id = $this->model->create($data, (int)$u['sub']);
        if (is_array($id) && isset($id['error'])) {
            $this->error($id['error'], 400);
            return;
        }
        if (!$id) {
            $this->error('Failed to create transfer', 400);
            return;
        }

        $this->audit->write([
            'user_id' => (int)$u['sub'],
            'location_id' => null,
            'action' => 'create',
            'entity' => 'stock_transfer',
            'entity_id' => (int)$id,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['transfer_id' => (int)$id]),
        ]);

        $this->success(['id' => (int)$id], 'Transfer request created');
    }

    public function receive($id = null) {
        $u = $this->requirePermission('transfer.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) $this->error('Transfer ID required', 400);

        // Only users who have access to the destination location can receive a transfer.
        try {
            $ids = $this->allowedLocationIds($u);
            $resCheck = $this->model->getById((int)$id);
            $toId = $resCheck && isset($resCheck->transfer) ? (int)($resCheck->transfer->to_location_id ?? 0) : 0;
            if ($toId > 0 && !$this->isAdmin($u) && !in_array($toId, $ids, true)) {
                $this->error('Forbidden', 403);
                return;
            }
        } catch (Exception $e) {
            // ignore best-effort
        }

        $res = $this->model->receive((int)$id, (int)$u['sub']);
        if ($res === true) {
            $this->audit->write([
                'user_id' => (int)$u['sub'],
                'location_id' => null,
                'action' => 'update',
                'entity' => 'stock_transfer_receive',
                'entity_id' => (int)$id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['transfer_id' => (int)$id]),
            ]);
            $this->success(['id' => (int)$id], 'Transfer received');
        }
        if (is_array($res) && isset($res['error'])) {
            $this->error($res['error'], 400);
        }
        $this->error('Receive failed', 400);
    }
}
