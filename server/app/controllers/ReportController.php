<?php
/**
 * Report Controller
 */
class ReportController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    private function resolveLocationIds($u, $locationParam, $defaultAllForAdmin = true) {
        // Returns a list of location ids the user is allowed to query for reports.
        $isAdmin = (string)($u['role'] ?? '') === 'Admin';
        $locRaw = is_string($locationParam) ? trim($locationParam) : (string)($locationParam ?? '');
        $locRawLower = strtolower($locRaw);

        $allowed = [];
        if (!$isAdmin) {
            $allowed = $u['allowed_location_ids'] ?? null;
            if (!is_array($allowed) || count($allowed) === 0) {
                $allowed = [$this->currentLocationId($u)];
            }
            $allowed = array_values(array_unique(array_filter(array_map('intval', $allowed), function($x) { return $x > 0; })));
        }

        if ($isAdmin) {
            if ($locRawLower === 'all' || ($locRaw === '' && $defaultAllForAdmin)) {
                $this->db->query("SELECT id FROM service_locations ORDER BY id ASC");
                $rows = $this->db->resultSet();
                $ids = array_map(function($r) { return (int)$r->id; }, $rows ?: []);
                $ids = array_values(array_unique(array_filter($ids, function($x) { return $x > 0; })));
                return count($ids) ? $ids : [1];
            }
            $id = (int)$locRaw;
            return $id > 0 ? [$id] : [1];
        }

        if ($locRawLower === 'all' || $locRaw === '') {
            return count($allowed) ? $allowed : [1];
        }
        $want = (int)$locRaw;
        if ($want > 0 && in_array($want, $allowed, true)) return [$want];
        return count($allowed) ? $allowed : [1];
    }

    private function inList($prefix, $values) {
        $names = [];
        $i = 0;
        foreach ($values as $v) {
            $key = ':' . $prefix . $i;
            $names[] = $key;
            $i++;
        }
        return implode(',', $names);
    }

    private function bindInList($prefix, $values) {
        $i = 0;
        foreach ($values as $v) {
            $this->db->bind(':' . $prefix . $i, $v);
            $i++;
        }
    }

    // GET /api/report/overview
    public function overview() {
        $this->requirePermission('reports.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        // Orders by status
        $this->db->query("SELECT status, COUNT(*) AS cnt FROM repair_orders GROUP BY status");
        $rows = $this->db->resultSet();
        $byStatus = [];
        $totalOrders = 0;
        foreach ($rows as $r) {
            $byStatus[$r->status] = (int)$r->cnt;
            $totalOrders += (int)$r->cnt;
        }

        // Orders per day (last 7 days)
        $this->db->query("
            SELECT DATE(created_at) AS d, COUNT(*) AS cnt
            FROM repair_orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(created_at)
            ORDER BY d ASC
        ");
        $dailyRows = $this->db->resultSet();
        $ordersLast7Days = array_map(function($r) {
            return ['date' => (string)$r->d, 'count' => (int)$r->cnt];
        }, $dailyRows ?: []);

        // Totals
        $counts = [];
        foreach ([
            'vehicles' => 'vehicles',
            'technicians' => 'technicians',
            'service_bays' => 'service_bays',
            'repair_categories' => 'repair_categories',
            'checklist_templates' => 'checklist_templates'
        ] as $k => $tbl) {
            $this->db->query("SELECT COUNT(*) AS cnt FROM {$tbl}");
            $obj = $this->db->single();
            $counts[$k] = $obj ? (int)$obj->cnt : 0;
        }

        $this->success([
            'totalOrders' => $totalOrders,
            'ordersByStatus' => $byStatus,
            'ordersLast7Days' => $ordersLast7Days,
            'counts' => $counts,
        ]);
    }

    // GET /api/report/stock_balance?location_id=all|1&group=item|location&q=&as_of=YYYY-MM-DD
    public function stock_balance() {
        $u = $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);

        $q = trim((string)($_GET['q'] ?? ''));
        $group = strtolower(trim((string)($_GET['group'] ?? 'item')));
        if (!in_array($group, ['item','location'], true)) $group = 'item';
        $asOf = trim((string)($_GET['as_of'] ?? ''));
        $asOfEnd = null;
        if ($asOf !== '') $asOfEnd = $asOf . ' 23:59:59';

        $locIds = $this->resolveLocationIds($u, $_GET['location_id'] ?? null, true);
        $inLoc = $this->inList('loc', $locIds);

        $whereParts = [];
        if ($q !== '') $whereParts[] = "(p.part_name LIKE :q OR p.sku LIKE :q OR p.part_number LIKE :q OR p.barcode_number LIKE :q)";
        $wherePartsSql = count($whereParts) ? ('AND ' . implode(' AND ', $whereParts)) : '';

        if ($group === 'location') {
            $sql = "
                SELECT
                  l.id AS location_id,
                  l.name AS location_name,
                  p.id AS part_id,
                  p.part_name,
                  p.sku,
                  p.unit,
                  b.name AS brand_name,
                  p.reorder_level,
                  p.cost_price,
                  COALESCE(SUM(sm.qty_change), 0) AS qty
                FROM parts p
                CROSS JOIN service_locations l
                LEFT JOIN brands b ON b.id = p.brand_id
                LEFT JOIN stock_movements sm
                  ON sm.part_id = p.id AND sm.location_id = l.id
                  " . ($asOfEnd ? "AND sm.created_at <= :asOfEnd" : "") . "
                WHERE l.id IN ($inLoc)
                $wherePartsSql
                GROUP BY l.id, p.id
                ORDER BY l.name ASC, p.part_name ASC
            ";
            $this->db->query($sql);
            $this->bindInList('loc', $locIds);
            if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
            if ($asOfEnd) $this->db->bind(':asOfEnd', $asOfEnd);
            $rows = $this->db->resultSet();
            $this->success($rows);
            return;
        }

        $sql = "
            SELECT
              p.id AS part_id,
              p.part_name,
              p.sku,
              p.unit,
              b.name AS brand_name,
              p.reorder_level,
              p.cost_price,
              COALESCE(SUM(sm.qty_change), 0) AS qty
            FROM parts p
            LEFT JOIN brands b ON b.id = p.brand_id
            LEFT JOIN stock_movements sm
              ON sm.part_id = p.id
             AND sm.location_id IN ($inLoc)
              " . ($asOfEnd ? "AND sm.created_at <= :asOfEnd" : "") . "
            WHERE 1=1
            $wherePartsSql
            GROUP BY p.id
            ORDER BY p.part_name ASC
        ";
        $this->db->query($sql);
        $this->bindInList('loc', $locIds);
        if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
        if ($asOfEnd) $this->db->bind(':asOfEnd', $asOfEnd);
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // GET /api/report/low_stock?location_id=all|1&q=
    public function low_stock() {
        $u = $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $q = trim((string)($_GET['q'] ?? ''));
        $locIds = $this->resolveLocationIds($u, $_GET['location_id'] ?? null, true);
        $inLoc = $this->inList('loc', $locIds);

        $sql = "
            SELECT
              p.id AS part_id,
              p.part_name,
              p.sku,
              p.unit,
              b.name AS brand_name,
              p.reorder_level,
              COALESCE(SUM(sm.qty_change), 0) AS qty
            FROM parts p
            LEFT JOIN brands b ON b.id = p.brand_id
            LEFT JOIN stock_movements sm
              ON sm.part_id = p.id AND sm.location_id IN ($inLoc)
            WHERE p.reorder_level IS NOT NULL
              AND p.reorder_level > 0
              " . ($q !== '' ? "AND (p.part_name LIKE :q OR p.sku LIKE :q)" : "") . "
            GROUP BY p.id
            HAVING qty <= p.reorder_level
            ORDER BY qty ASC, p.part_name ASC
        ";
        $this->db->query($sql);
        $this->bindInList('loc', $locIds);
        if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // GET /api/report/item_movements?part_id=1&location_id=all|1&from=YYYY-MM-DD&to=YYYY-MM-DD&movement_type=&limit=200&offset=0
    public function item_movements() {
        $u = $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);

        $partId = (int)($_GET['part_id'] ?? 0);
        if ($partId <= 0) $this->error('part_id is required', 400);

        $locIds = $this->resolveLocationIds($u, $_GET['location_id'] ?? null, true);
        $inLoc = $this->inList('loc', $locIds);
        $from = trim((string)($_GET['from'] ?? ''));
        $to = trim((string)($_GET['to'] ?? ''));
        $type = trim((string)($_GET['movement_type'] ?? ''));
        $limit = (int)($_GET['limit'] ?? 200);
        $offset = (int)($_GET['offset'] ?? 0);
        if ($limit <= 0) $limit = 200;
        if ($limit > 1000) $limit = 1000;
        if ($offset < 0) $offset = 0;

        $where = ["sm.location_id IN ($inLoc)", "sm.part_id = :pid"];
        if ($from !== '') $where[] = "sm.created_at >= :fromDt";
        if ($to !== '') $where[] = "sm.created_at <= :toDt";
        if ($type !== '') $where[] = "sm.movement_type = :mtype";
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
              sm.*,
              l.name AS location_name,
              p.part_name,
              p.sku,
              b.name AS brand_name,
              CASE
                WHEN sm.ref_table = 'goods_receive_notes' THEN (SELECT grn_number FROM goods_receive_notes g WHERE g.id = sm.ref_id LIMIT 1)
                WHEN sm.ref_table = 'stock_adjustments' THEN (SELECT adjustment_number FROM stock_adjustments a WHERE a.id = sm.ref_id LIMIT 1)
                WHEN sm.ref_table = 'stock_transfer_requests' THEN (SELECT transfer_number FROM stock_transfer_requests t WHERE t.id = sm.ref_id LIMIT 1)
                WHEN sm.ref_table = 'purchase_orders' THEN (SELECT po_number FROM purchase_orders po WHERE po.id = sm.ref_id LIMIT 1)
                ELSE NULL
              END AS doc_no
            FROM stock_movements sm
            INNER JOIN parts p ON p.id = sm.part_id
            LEFT JOIN brands b ON b.id = p.brand_id
            LEFT JOIN service_locations l ON l.id = sm.location_id
            WHERE $whereSql
            ORDER BY sm.created_at DESC, sm.id DESC
            LIMIT $limit OFFSET $offset
        ";
        $this->db->query($sql);
        $this->bindInList('loc', $locIds);
        $this->db->bind(':pid', $partId);
        if ($from !== '') $this->db->bind(':fromDt', $from . ' 00:00:00');
        if ($to !== '') $this->db->bind(':toDt', $to . ' 23:59:59');
        if ($type !== '') $this->db->bind(':mtype', $type);
        $rows = $this->db->resultSet();

        // Add a best-effort frontend link for common docs
        $out = array_map(function($r) {
            $refUrl = null;
            if ($r->ref_table === 'goods_receive_notes') $refUrl = '/inventory/grn/print/' . $r->ref_id;
            if ($r->ref_table === 'purchase_orders') $refUrl = '/inventory/purchase-orders/print/' . $r->ref_id;
            if ($r->ref_table === 'stock_adjustments') $refUrl = '/inventory/stock/adjustments/' . $r->ref_id;
            if ($r->ref_table === 'stock_transfer_requests') $refUrl = '/inventory/transfers/' . $r->ref_id;
            $r->ref_url = $refUrl;
            return $r;
        }, $rows ?: []);

        $this->success($out);
    }

    // GET /api/report/stock_transfers?location_id=all|1&from=YYYY-MM-DD&to=YYYY-MM-DD&status=
    public function stock_transfers() {
        $u = $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);

        $locIds = $this->resolveLocationIds($u, $_GET['location_id'] ?? null, true);
        $inFrom = $this->inList('fromloc', $locIds);
        $inTo = $this->inList('toloc', $locIds);
        $from = trim((string)($_GET['from'] ?? ''));
        $to = trim((string)($_GET['to'] ?? ''));
        $status = trim((string)($_GET['status'] ?? ''));

        $where = ["(r.from_location_id IN ($inFrom) OR r.to_location_id IN ($inTo))"];
        if ($from !== '') $where[] = "r.requested_at >= :fromDt";
        if ($to !== '') $where[] = "r.requested_at <= :toDt";
        if ($status !== '') $where[] = "r.status = :st";
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT r.*,
                   lf.name AS from_location_name,
                   lt.name AS to_location_name,
                   COUNT(i.id) AS line_count,
                   COALESCE(SUM(i.qty), 0) AS total_qty,
                   COALESCE(SUM(i.qty * COALESCE(p.cost_price, 0)), 0) AS total_value_info
            FROM stock_transfer_requests r
            LEFT JOIN service_locations lf ON lf.id = r.from_location_id
            LEFT JOIN service_locations lt ON lt.id = r.to_location_id
            LEFT JOIN stock_transfer_items i ON i.transfer_id = r.id
            LEFT JOIN parts p ON p.id = i.part_id
            WHERE $whereSql
            GROUP BY r.id
            ORDER BY r.id DESC
        ";
        $this->db->query($sql);
        $this->bindInList('fromloc', $locIds);
        $this->bindInList('toloc', $locIds);
        if ($from !== '') $this->db->bind(':fromDt', $from . ' 00:00:00');
        if ($to !== '') $this->db->bind(':toDt', $to . ' 23:59:59');
        if ($status !== '') $this->db->bind(':st', $status);
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // GET /api/report/vehicles?q=&department_id=
    public function vehicles() {
        $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $q = trim((string)($_GET['q'] ?? ''));
        $dep = (int)($_GET['department_id'] ?? 0);

        $sql = "
            SELECT v.*,
                   d.name AS department_name
            FROM vehicles v
            LEFT JOIN departments d ON d.id = v.department_id
            WHERE 1=1
              " . ($dep > 0 ? "AND v.department_id = :dep" : "") . "
              " . ($q !== '' ? "AND (v.make LIKE :q OR v.model LIKE :q OR v.vin LIKE :q)" : "") . "
            ORDER BY v.id DESC
        ";
        $this->db->query($sql);
        if ($dep > 0) $this->db->bind(':dep', $dep);
        if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // GET /api/report/vehicle_history?vehicle_id=1&from=YYYY-MM-DD&to=YYYY-MM-DD
    public function vehicle_history() {
        $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);

        $vehicleId = (int)($_GET['vehicle_id'] ?? 0);
        if ($vehicleId <= 0) $this->error('vehicle_id is required', 400);
        $from = trim((string)($_GET['from'] ?? ''));
        $to = trim((string)($_GET['to'] ?? ''));

        $where = ["o.vehicle_id = :vid"];
        if ($from !== '') $where[] = "o.created_at >= :fromDt";
        if ($to !== '') $where[] = "o.created_at <= :toDt";
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
              o.*,
              sl.name AS location_name,
              COALESCE(SUM(COALESCE(op.line_total, (op.unit_cost * op.quantity))), 0) AS parts_value
            FROM repair_orders o
            LEFT JOIN service_locations sl ON sl.id = o.location_id
            LEFT JOIN order_parts op ON op.order_id = o.id
            WHERE $whereSql
            GROUP BY o.id
            ORDER BY o.created_at DESC, o.id DESC
        ";
        $this->db->query($sql);
        $this->db->bind(':vid', $vehicleId);
        if ($from !== '') $this->db->bind(':fromDt', $from . ' 00:00:00');
        if ($to !== '') $this->db->bind(':toDt', $to . ' 23:59:59');
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // GET /api/report/items?q=&brand_id=&supplier_id=&active=1
    public function items() {
        $this->requirePermission('reports.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') $this->error('Method Not Allowed', 405);
        $q = trim((string)($_GET['q'] ?? ''));
        $brandId = (int)($_GET['brand_id'] ?? 0);
        $supplierId = (int)($_GET['supplier_id'] ?? 0);
        $active = isset($_GET['active']) ? (int)$_GET['active'] : -1;

        $where = ["1=1"];
        if ($q !== '') $where[] = "(p.part_name LIKE :q OR p.sku LIKE :q OR p.part_number LIKE :q OR p.barcode_number LIKE :q)";
        if ($brandId > 0) $where[] = "p.brand_id = :bid";
        if ($active === 0 || $active === 1) $where[] = "p.is_active = :act";
        if ($supplierId > 0) {
            $where[] = "EXISTS (SELECT 1 FROM part_suppliers ps WHERE ps.part_id = p.id AND ps.supplier_id = :sid)";
        }
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT p.*, b.name AS brand_name
            FROM parts p
            LEFT JOIN brands b ON b.id = p.brand_id
            WHERE $whereSql
            ORDER BY p.part_name ASC
        ";
        $this->db->query($sql);
        if ($q !== '') $this->db->bind(':q', '%' . $q . '%');
        if ($brandId > 0) $this->db->bind(':bid', $brandId);
        if ($active === 0 || $active === 1) $this->db->bind(':act', $active);
        if ($supplierId > 0) $this->db->bind(':sid', $supplierId);
        $rows = $this->db->resultSet();
        $this->success($rows);
    }
}
