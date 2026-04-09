<?php
/**
 * Bay Controller
 */

class BayController extends Controller {
    private $bayModel;
    private $auditModel;
    private $db;

    public function __construct() {
        $this->bayModel = $this->model('ServiceBay');
        $this->auditModel = $this->model('AuditLog');
        $this->db = new Database();
    }

    // GET /api/bay/list
    public function list() {
        $u = $this->requirePermission('bays.read');
        if ($_SERVER['REQUEST_METHOD'] == 'GET') {
            $locId = $this->currentLocationId($u);
            $bays = $this->bayModel->getAllByLocation($locId);
            $this->success($bays);
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // GET /api/bay/board
    // Returns bays + current active assignment info (order details) for management dashboards.
    public function board() {
        $u = $this->requirePermission('bays.read');
        // Order details are included, so require orders.read as well.
        $this->requirePermission('orders.read');

        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $locId = $this->currentLocationId($u);

        // Bays in this location
        $this->db->query("SELECT id, name, status FROM service_bays WHERE location_id = :location_id ORDER BY name ASC");
        $this->db->bind(':location_id', $locId);
        $bays = $this->db->resultSet() ?: [];

        // Active orders in this location (assignment is tracked via repair_orders.location = bay name)
        $this->db->query("
            SELECT
                id,
                vehicle_id,
                vehicle_model,
                vehicle_identifier,
                mileage,
                priority,
                status,
                expected_time,
                technician,
                location,
                created_at,
                updated_at
            FROM repair_orders
            WHERE location_id = :location_id
              AND status IN ('Pending','In Progress')
            ORDER BY created_at DESC
        ");
        $this->db->bind(':location_id', $locId);
        $orders = $this->db->resultSet() ?: [];

        // Map active orders by bay name.
        $byBay = [];
        $unassigned = [];
        foreach ($orders as $o) {
            $bayName = trim((string)($o->location ?? ''));
            if ($bayName === '') {
                $unassigned[] = $o;
                continue;
            }
            if (!isset($byBay[$bayName])) {
                $byBay[$bayName] = [];
            }
            $byBay[$bayName][] = $o;
        }

        $outBays = [];
        foreach ($bays as $b) {
            $name = (string)$b->name;
            $list = $byBay[$name] ?? [];
            $active = count($list) > 0 ? $list[0] : null; // most recent
            $outBays[] = [
                'id' => (int)$b->id,
                'name' => $name,
                'status' => (string)$b->status,
                'active_order' => $active ? [
                    'id' => (int)$active->id,
                    'vehicle_id' => $active->vehicle_id !== null ? (int)$active->vehicle_id : null,
                    'vehicle_model' => (string)$active->vehicle_model,
                    'vehicle_identifier' => $active->vehicle_identifier ? (string)$active->vehicle_identifier : null,
                    'mileage' => $active->mileage !== null ? (int)$active->mileage : null,
                    'priority' => $active->priority ? (string)$active->priority : null,
                    'status' => (string)$active->status,
                    'expected_time' => $active->expected_time ? (string)$active->expected_time : null,
                    'technician' => $active->technician ? (string)$active->technician : null,
                    'created_at' => (string)$active->created_at,
                    'updated_at' => (string)$active->updated_at,
                ] : null,
                'active_orders_count' => count($list),
            ];
        }

        // Also return any "assigned" orders where the bay name doesn't exist (data integrity help)
        $knownBayNames = array_map(function($b) { return (string)$b->name; }, $bays);
        $unknownAssigned = [];
        foreach ($byBay as $bayName => $list) {
            if (!in_array((string)$bayName, $knownBayNames, true)) {
                foreach ($list as $o) {
                    $unknownAssigned[] = [
                        'id' => (int)$o->id,
                        'vehicle_model' => (string)$o->vehicle_model,
                        'status' => (string)$o->status,
                        'priority' => $o->priority ? (string)$o->priority : null,
                        'expected_time' => $o->expected_time ? (string)$o->expected_time : null,
                        'technician' => $o->technician ? (string)$o->technician : null,
                        'location' => (string)$o->location,
                        'created_at' => (string)$o->created_at,
                    ];
                }
            }
        }

        $outUnassigned = array_map(function($o) {
            return [
                'id' => (int)$o->id,
                'vehicle_id' => $o->vehicle_id !== null ? (int)$o->vehicle_id : null,
                'vehicle_model' => (string)$o->vehicle_model,
                'vehicle_identifier' => $o->vehicle_identifier ? (string)$o->vehicle_identifier : null,
                'mileage' => $o->mileage !== null ? (int)$o->mileage : null,
                'priority' => $o->priority ? (string)$o->priority : null,
                'status' => (string)$o->status,
                'expected_time' => $o->expected_time ? (string)$o->expected_time : null,
                'technician' => $o->technician ? (string)$o->technician : null,
                'created_at' => (string)$o->created_at,
            ];
        }, $unassigned);

        $this->success([
            'location_id' => $locId,
            'bays' => $outBays,
            'unassigned_active_orders' => $outUnassigned,
            'unknown_assigned_orders' => $unknownAssigned,
        ]);
    }

    // GET /api/bay/board_all
    // Returns the bay board for all locations the user is allowed to access.
    // - Admin: all locations
    // - Non-admin: locations in JWT payload `allowed_location_ids` (fallback to token location_id)
    public function board_all() {
        $u = $this->requirePermission('bays.read');
        $this->requirePermission('orders.read');

        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $allowedIds = [];
        if ($this->isAdmin($u)) {
            $this->db->query("SELECT id FROM service_locations ORDER BY id ASC");
            $rows = $this->db->resultSet() ?: [];
            foreach ($rows as $r) $allowedIds[] = (int)$r->id;
        } else {
            $ids = $u['allowed_location_ids'] ?? null;
            if (is_array($ids)) {
                foreach ($ids as $id) {
                    $id = (int)$id;
                    if ($id > 0) $allowedIds[] = $id;
                }
            }
            if (count($allowedIds) === 0) {
                $allowedIds = [isset($u['location_id']) ? (int)$u['location_id'] : 1];
            }
        }
        $allowedIds = array_values(array_unique(array_filter($allowedIds, function($x) { return (int)$x > 0; })));
        if (count($allowedIds) === 0) $allowedIds = [1];

        // Location rows (for names)
        $in = implode(',', array_fill(0, count($allowedIds), '?'));
        $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $stmt = $pdo->prepare("SELECT id, name FROM service_locations WHERE id IN ($in) ORDER BY id ASC");
        $stmt->execute($allowedIds);
        $locRows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $locNames = [];
        foreach ($locRows as $r) $locNames[(int)$r['id']] = (string)$r['name'];

        // Bays for allowed locations
        $stmt = $pdo->prepare("SELECT id, location_id, name, status FROM service_bays WHERE location_id IN ($in) ORDER BY location_id ASC, name ASC");
        $stmt->execute($allowedIds);
        $bays = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Active orders for allowed locations
        $stmt = $pdo->prepare("
            SELECT
                id,
                location_id,
                vehicle_id,
                vehicle_model,
                vehicle_identifier,
                mileage,
                priority,
                status,
                expected_time,
                technician,
                location,
                created_at,
                updated_at
            FROM repair_orders
            WHERE location_id IN ($in)
              AND status IN ('Pending','In Progress')
            ORDER BY created_at DESC
        ");
        $stmt->execute($allowedIds);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        // Group orders by (location_id, bay_name)
        $ordersByLocBay = []; // [locId][bayName] => list
        $unassignedByLoc = []; // [locId] => list
        foreach ($orders as $o) {
            $locId = (int)$o['location_id'];
            $bayName = trim((string)($o['location'] ?? ''));
            if ($bayName === '') {
                if (!isset($unassignedByLoc[$locId])) $unassignedByLoc[$locId] = [];
                $unassignedByLoc[$locId][] = $o;
                continue;
            }
            if (!isset($ordersByLocBay[$locId])) $ordersByLocBay[$locId] = [];
            if (!isset($ordersByLocBay[$locId][$bayName])) $ordersByLocBay[$locId][$bayName] = [];
            $ordersByLocBay[$locId][$bayName][] = $o;
        }

        // Build output grouped by location
        $outLocations = [];
        $knownBayNamesByLoc = [];
        foreach ($bays as $b) {
            $locId = (int)$b['location_id'];
            if (!isset($knownBayNamesByLoc[$locId])) $knownBayNamesByLoc[$locId] = [];
            $knownBayNamesByLoc[$locId][] = (string)$b['name'];
        }

        $baysByLoc = [];
        foreach ($bays as $b) {
            $locId = (int)$b['location_id'];
            if (!isset($baysByLoc[$locId])) $baysByLoc[$locId] = [];
            $baysByLoc[$locId][] = $b;
        }

        foreach ($allowedIds as $locId) {
            $locId = (int)$locId;
            $locBays = $baysByLoc[$locId] ?? [];
            $outBays = [];
            foreach ($locBays as $b) {
                $name = (string)$b['name'];
                $list = $ordersByLocBay[$locId][$name] ?? [];
                $active = count($list) > 0 ? $list[0] : null;

                $outBays[] = [
                    'id' => (int)$b['id'],
                    'name' => $name,
                    'status' => (string)$b['status'],
                    'active_order' => $active ? [
                        'id' => (int)$active['id'],
                        'vehicle_id' => $active['vehicle_id'] !== null ? (int)$active['vehicle_id'] : null,
                        'vehicle_model' => (string)$active['vehicle_model'],
                        'vehicle_identifier' => $active['vehicle_identifier'] ? (string)$active['vehicle_identifier'] : null,
                        'mileage' => $active['mileage'] !== null ? (int)$active['mileage'] : null,
                        'priority' => $active['priority'] ? (string)$active['priority'] : null,
                        'status' => (string)$active['status'],
                        'expected_time' => $active['expected_time'] ? (string)$active['expected_time'] : null,
                        'technician' => $active['technician'] ? (string)$active['technician'] : null,
                        'created_at' => (string)$active['created_at'],
                        'updated_at' => (string)$active['updated_at'],
                    ] : null,
                    'active_orders_count' => count($list),
                ];
            }

            // Unknown assigned orders for this location (bay name not in service_bays)
            $unknownAssigned = [];
            $known = $knownBayNamesByLoc[$locId] ?? [];
            $map = $ordersByLocBay[$locId] ?? [];
            foreach ($map as $bayName => $list) {
                if (!in_array((string)$bayName, $known, true)) {
                    foreach ($list as $o) {
                        $unknownAssigned[] = [
                            'id' => (int)$o['id'],
                            'vehicle_model' => (string)$o['vehicle_model'],
                            'status' => (string)$o['status'],
                            'priority' => $o['priority'] ? (string)$o['priority'] : null,
                            'expected_time' => $o['expected_time'] ? (string)$o['expected_time'] : null,
                            'technician' => $o['technician'] ? (string)$o['technician'] : null,
                            'location' => (string)$o['location'],
                            'created_at' => (string)$o['created_at'],
                        ];
                    }
                }
            }

            $outUnassigned = array_map(function($o) {
                return [
                    'id' => (int)$o['id'],
                    'vehicle_id' => $o['vehicle_id'] !== null ? (int)$o['vehicle_id'] : null,
                    'vehicle_model' => (string)$o['vehicle_model'],
                    'vehicle_identifier' => $o['vehicle_identifier'] ? (string)$o['vehicle_identifier'] : null,
                    'mileage' => $o['mileage'] !== null ? (int)$o['mileage'] : null,
                    'priority' => $o['priority'] ? (string)$o['priority'] : null,
                    'status' => (string)$o['status'],
                    'expected_time' => $o['expected_time'] ? (string)$o['expected_time'] : null,
                    'technician' => $o['technician'] ? (string)$o['technician'] : null,
                    'created_at' => (string)$o['created_at'],
                ];
            }, $unassignedByLoc[$locId] ?? []);

            $outLocations[] = [
                'location_id' => $locId,
                'location_name' => $locNames[$locId] ?? ('Location ' . $locId),
                'bays' => $outBays,
                'unassigned_active_orders' => $outUnassigned,
                'unknown_assigned_orders' => $unknownAssigned,
            ];
        }

        $this->success([
            'location_ids' => $allowedIds,
            'locations' => $outLocations,
        ]);
    }

    // POST /api/bay/create
    public function create() {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Bay name is required', 400);
            return;
        }

        $locId = $this->currentLocationId($u);
        $ok = $this->bayModel->create(trim($data['name']), (int)$u['sub'], $locId);
        if ($ok) {
            $this->success(null, 'Bay created');
        } else {
            $this->error('Create failed');
        }
    }

    // POST /api/bay/update/1
    public function update($id = null) {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Bay ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['name']) || trim($data['name']) === '') {
            $this->error('Bay name is required', 400);
            return;
        }

        $locId = $this->currentLocationId($u);
        $ok = $this->bayModel->update($id, trim($data['name']), (int)$u['sub'], $locId);
        if ($ok) {
            $this->success(null, 'Bay updated');
        } else {
            $this->error('Update failed');
        }
    }

    // DELETE /api/bay/delete/1
    public function delete($id = null) {
        $u = $this->requirePermission('bays.write');
        $method = $_SERVER['REQUEST_METHOD'];
        if ($method === 'POST') {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true);
            if (isset($data['_method']) && $data['_method'] === 'DELETE') {
                $method = 'DELETE';
            }
        }
        if ($method !== 'DELETE') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('Bay ID required', 400);
            return;
        }

        $locId = $this->currentLocationId($u);
        $ok = $this->bayModel->delete($id, $locId);
        if ($ok) {
            $this->success(null, 'Bay deleted');
        } else {
            $this->error('Delete failed');
        }
    }

    // POST /api/bay/update_status/1
    public function update_status($id = null) {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {
            $raw_data = file_get_contents('php://input');
            $data = json_decode($raw_data, true);

            if (!$id || !isset($data['status'])) {
                $this->error('Missing required data', 400);
            }

            $locId = $this->currentLocationId($u);
            if ($this->bayModel->updateStatus($id, $data['status'], (int)$u['sub'], $locId)) {
                $this->success(['id' => $id, 'status' => $data['status']], 'Bay status updated');
            } else {
                $this->error('Update failed');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }
}
