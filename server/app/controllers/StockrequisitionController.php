<?php
/**
 * Stock Requisition Controller
 * Destination location requests stock; then a shipment can be created from that request.
 *
 * Endpoints:
 * - GET  /api/stockrequisition/list
 * - GET  /api/stockrequisition/get/{id}
 * - POST /api/stockrequisition/create
 * - POST /api/stockrequisition/approve/{id}
 */
class StockrequisitionController extends Controller {
    private $model;
    private $audit;

    public function __construct() {
        $this->model = $this->model('StockRequisition');
        $this->audit = $this->model('AuditLog');
    }

    private function hasWarehouseLocation($locationIds = []) {
        $ids = array_values(array_filter(array_map('intval', (array)$locationIds), function($x) { return $x > 0; }));
        if (count($ids) === 0) return false;
        $in = implode(',', array_fill(0, count($ids), '?'));
        $db = new Database();
        $db->query("SELECT COUNT(*) AS c FROM service_locations WHERE id IN ($in) AND location_type = 'warehouse'");
        foreach ($ids as $i => $id) {
            $db->bind(($i + 1), $id);
        }
        $row = $db->single();
        return (int)($row->c ?? 0) > 0;
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

        // Destination locations can see their own requests. Warehouses (and Admin) can see all open requests.
        $rows = null;
        if ($this->isAdmin($u) || $this->hasWarehouseLocation($ids)) {
            $rows = $this->model->listOpen();
        } else {
            $rows = $this->model->listByLocations($ids);
        }
        $this->success($rows);
    }

    public function get($id = null) {
        $u = $this->requirePermission('transfer.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) $this->error('Requisition ID required', 400);
        $res = $this->model->getById((int)$id);
        if (!$res) $this->error('Requisition not found', 404);

        // Access control: destination locations can view their own requests.
        // Warehouses (and Admin) can view all requests.
        try {
            $ids = $this->allowedLocationIds($u);
            $toId = (int)(($res->requisition->to_location_id ?? 0));
            if (!$this->isAdmin($u) && !$this->hasWarehouseLocation($ids) && !in_array($toId, $ids, true)) {
                $this->error('Forbidden', 403);
                return;
            }
        } catch (Exception $e) {
            // ignore best-effort
        }

        $this->success($res);
    }

    public function create() {
        $u = $this->requirePermission('transfer.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];

        // Non-admin users can only request stock for their allowed locations.
        try {
            if (!$this->isAdmin($u)) {
                $ids = $this->allowedLocationIds($u);
                $toId = (int)($data['to_location_id'] ?? $data['toLocationId'] ?? 0);
                if ($toId > 0 && !in_array($toId, $ids, true)) {
                    $this->error('Forbidden', 403);
                    return;
                }
            }
        } catch (Exception $e) {
            // ignore best-effort
        }

        $id = $this->model->create($data, (int)$u['sub']);
        if (!$id) $this->error('Failed to create requisition', 400);

        $this->audit->write([
            'user_id' => (int)$u['sub'],
            'location_id' => null,
            'action' => 'create',
            'entity' => 'stock_requisition',
            'entity_id' => (int)$id,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['requisition_id' => (int)$id]),
        ]);

        $this->success(['id' => (int)$id], 'Requisition created');
    }

    public function approve($id = null) {
        $u = $this->requirePermission('transfer.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) $this->error('Requisition ID required', 400);

        // Access control: destination locations can approve their own requests.
        // Warehouses (and Admin) can approve all requests.
        try {
            if (!$this->isAdmin($u)) {
                $ids = $this->allowedLocationIds($u);
                if (!$this->hasWarehouseLocation($ids)) {
                    $res = $this->model->getById((int)$id);
                    $toId = $res && isset($res->requisition) ? (int)($res->requisition->to_location_id ?? 0) : 0;
                    if ($toId > 0 && !in_array($toId, $ids, true)) {
                        $this->error('Forbidden', 403);
                        return;
                    }
                }
            }
        } catch (Exception $e) {
            // ignore
        }

        $ok = $this->model->approve((int)$id, (int)$u['sub']);
        if (!$ok) $this->error('Approve failed', 400);
        $this->success(['id' => (int)$id], 'Requisition approved');
    }
}
