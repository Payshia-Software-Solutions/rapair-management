<?php
/**
 * FloorController - restaurant floor plan (Phase 2 of POS profiles).
 *
 *   GET  /api/floor/layout?location_id=   areas, tables (with position) and drawing objects
 *   POST /api/floor/merge                 { primary_table_id, table_ids: [] }  seat a group across tables:
 *        the others are joined to the main table; open bills on them move onto the main bill
 *   POST /api/floor/unmerge               { table_id }  split a group again (any table of it)
 *   POST /api/floor/save                  the whole plan from the designer, in one transaction:
 *        { location_id, areas: [{ id?, key, name, width, height, tables: [...], objects: [...] }],
 *          deleted_area_ids: [], deleted_table_ids: [] }
 *
 * Tables without a position (made before the floor plan existed) come back with area_id null so
 * the designer can place them. The POS reads the same layout and colours tables from held bills.
 */
require_once __DIR__ . '/../helpers/PosFloorSchema.php';

class FloorController extends Controller {
    private $db;

    private const SHAPES = ['square', 'round', 'rect'];
    private const OBJECT_KINDS = ['wall', 'bar', 'door', 'kitchen', 'plant', 'label', 'pool'];

    public function __construct() {
        $this->db = new Database();
    }

    private function locationFor($u) {
        $id = (int)($_GET['location_id'] ?? 0);
        return $id > 0 ? $id : (int)$this->currentLocationId($u);
    }

    private static function int($v, $min, $max, $def) {
        if (!is_numeric($v)) return $def;
        return max($min, min($max, (int)round($v)));
    }

    public function layout() {
        $u = $this->requireAuth();
        $loc = $this->locationFor($u);
        $data = PosFloorSchema::run($this->db, function () use ($loc) {
            $this->db->query("SELECT id, name, sort_order, width, height FROM restaurant_areas WHERE location_id = :l ORDER BY sort_order, id");
            $this->db->bind(':l', $loc);
            $areas = $this->db->resultSet() ?: [];

            $this->db->query("SELECT id, name, status, area_id, pos_x, pos_y, width, height, rotation, shape, seats, joined_to
                FROM restaurant_tables WHERE location_id = :l ORDER BY name");
            $this->db->bind(':l', $loc);
            $tables = $this->db->resultSet() ?: [];

            $objects = [];
            if ($areas) {
                $ids = implode(',', array_map(fn($a) => (int)$a->id, $areas));
                $this->db->query("SELECT id, area_id, kind, label, pos_x, pos_y, width, height, rotation
                    FROM restaurant_layout_objects WHERE area_id IN ($ids) ORDER BY id");
                $objects = $this->db->resultSet() ?: [];
            }
            return ['location_id' => $loc, 'areas' => $areas, 'tables' => $tables, 'objects' => $objects];
        });
        $this->success($data);
    }

    /** Open (held) bill on a table, or null. */
    private function openBill($tableId) {
        $this->db->query("SELECT * FROM pos_held_orders WHERE table_id = :t AND status = 'pending' ORDER BY id LIMIT 1");
        $this->db->bind(':t', (int)$tableId);
        return $this->db->single() ?: null;
    }

    public function merge() {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $primary = (int)($d['primary_table_id'] ?? 0);
        $others = array_values(array_unique(array_filter(array_map('intval', (array)($d['table_ids'] ?? [])), fn($i) => $i > 0 && $i !== $primary)));
        if (!$primary || !$others) { $this->error('Pick the main table and at least one more.', 422); return; }

        // Make sure the joined_to column exists (first use in this workspace)
        PosFloorSchema::run($this->db, function () {
            $this->db->query("SELECT joined_to FROM restaurant_tables WHERE 1=0");
            $this->db->resultSet();
        });

        $ids = implode(',', array_merge([$primary], $others));
        $this->db->query("SELECT id, location_id, name, joined_to FROM restaurant_tables WHERE id IN ($ids)");
        $rows = $this->db->resultSet() ?: [];
        if (count($rows) !== count($others) + 1) { $this->error('One of the tables no longer exists.', 404); return; }
        $locs = array_unique(array_map(fn($r) => (int)$r->location_id, $rows));
        if (count($locs) !== 1) { $this->error('Tables must be in the same location.', 422); return; }

        try {
            $this->db->beginTransaction();
            $main = $this->openBill($primary);
            $moved = 0;
            foreach ($others as $tid) {
                $bill = $this->openBill($tid);
                if ($bill) {
                    if (!$main) {
                        // The group's first bill becomes the main bill, now on the main table
                        $this->db->query("UPDATE pos_held_orders SET table_id = :p WHERE id = :id");
                        $this->db->bind(':p', $primary); $this->db->bind(':id', (int)$bill->id); $this->db->execute();
                        $main = $bill;
                    } else {
                        // Items move onto the main bill (KOT state kept); the emptied bill is closed
                        $this->db->query("UPDATE pos_held_order_items SET held_order_id = :m WHERE held_order_id = :b");
                        $this->db->bind(':m', (int)$main->id); $this->db->bind(':b', (int)$bill->id); $this->db->execute();
                        $this->db->query("UPDATE pos_held_orders SET subtotal = subtotal + :s, tax_total = tax_total + :t,
                            discount_total = discount_total + :dc, grand_total = grand_total + :g WHERE id = :m");
                        $this->db->bind(':s', (float)$bill->subtotal); $this->db->bind(':t', (float)$bill->tax_total);
                        $this->db->bind(':dc', (float)$bill->discount_total); $this->db->bind(':g', (float)$bill->grand_total);
                        $this->db->bind(':m', (int)$main->id); $this->db->execute();
                        $this->db->query("UPDATE pos_held_orders SET status = 'cancelled',
                            notes = CONCAT(COALESCE(notes, ''), :n) WHERE id = :b");
                        $this->db->bind(':n', ' [Merged into bill #' . (int)$main->id . ']');
                        $this->db->bind(':b', (int)$bill->id); $this->db->execute();
                        $moved++;
                    }
                }
                // The table and anything already joined to it now belong to the main table
                $this->db->query("UPDATE restaurant_tables SET joined_to = :p WHERE id = :t OR joined_to = :t2");
                $this->db->bind(':p', $primary); $this->db->bind(':t', $tid); $this->db->bind(':t2', $tid); $this->db->execute();
            }
            $this->db->query("UPDATE restaurant_tables SET joined_to = NULL WHERE id = :p");
            $this->db->bind(':p', $primary); $this->db->execute();
            $this->db->commit();
        } catch (Throwable $e) {
            try { $this->db->rollBack(); } catch (Throwable $ignored) {}
            error_log('Floor merge: ' . $e->getMessage());
            $this->error('Could not merge the tables. Try again.', 500);
            return;
        }
        $this->success(['main_bill_id' => $main ? (int)$main->id : null, 'bills_merged' => $moved],
            $moved ? "Tables merged; $moved bill(s) moved onto the main bill" : 'Tables merged');
    }

    public function unmerge() {
        $this->requirePermission(['pos.write', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $tid = (int)($d['table_id'] ?? 0);
        if (!$tid) { $this->error('Table required', 400); return; }
        PosFloorSchema::run($this->db, function () use ($tid) {
            // Find the group's main table from any of its tables
            $this->db->query("SELECT COALESCE(joined_to, id) AS main FROM restaurant_tables WHERE id = :t");
            $this->db->bind(':t', $tid);
            $main = (int)($this->db->single()->main ?? 0);
            if (!$main) return;
            $this->db->query("UPDATE restaurant_tables SET joined_to = NULL WHERE joined_to = :m");
            $this->db->bind(':m', $main);
            $this->db->execute();
        });
        $this->success(null, 'Tables split');
    }
    public function save() {
        $u = $this->requirePermission('bays.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $loc = (int)($d['location_id'] ?? 0) ?: (int)$this->currentLocationId($u);
        $areas = is_array($d['areas'] ?? null) ? $d['areas'] : [];
        if (!$areas) { $this->error('Add at least one area.', 422); return; }

        // Upgrade the workspace first: ALTER/CREATE can't run inside the transaction below
        PosFloorSchema::run($this->db, function () {
            $this->db->query("SELECT (SELECT COUNT(*) FROM restaurant_areas WHERE 1=0) a,
                (SELECT COUNT(*) FROM restaurant_layout_objects WHERE 1=0) o,
                (SELECT MAX(area_id) FROM restaurant_tables WHERE 1=0) t");
            $this->db->single();
        });

        // Tables with an open bill can't be removed
        $delTables = array_values(array_filter(array_map('intval', (array)($d['deleted_table_ids'] ?? []))));
        if ($delTables) {
            $in = implode(',', $delTables);
            $this->db->query("SELECT rt.name FROM pos_held_orders h JOIN restaurant_tables rt ON rt.id = h.table_id
                WHERE h.status = 'pending' AND h.table_id IN ($in) LIMIT 1");
            $busy = $this->db->single();
            if ($busy) { $this->error("Table \"{$busy->name}\" has an open bill. Close it before removing the table.", 409); return; }
        }

        $names = [];
        foreach ($areas as $a) {
            foreach ((array)($a['tables'] ?? []) as $t) {
                $n = mb_strtolower(trim((string)($t['name'] ?? '')));
                if ($n === '') { $this->error('Every table needs a name.', 422); return; }
                if (isset($names[$n])) { $this->error("Two tables are named \"" . trim($t['name']) . "\". Use different names.", 422); return; }
                $names[$n] = true;
            }
        }

        try {
            $this->db->beginTransaction();

            if ($delTables) {
                $in = implode(',', $delTables);
                $this->db->query("DELETE FROM restaurant_tables WHERE location_id = :l AND id IN ($in)");
                $this->db->bind(':l', $loc);
                $this->db->execute();
            }
            $delAreas = array_values(array_filter(array_map('intval', (array)($d['deleted_area_ids'] ?? []))));
            if ($delAreas) {
                $in = implode(',', $delAreas);
                // Tables on a removed area go back to "not placed"
                $this->db->query("UPDATE restaurant_tables SET area_id = NULL, pos_x = NULL, pos_y = NULL WHERE location_id = :l AND area_id IN ($in)");
                $this->db->bind(':l', $loc);
                $this->db->execute();
                $this->db->query("DELETE FROM restaurant_layout_objects WHERE area_id IN (SELECT id FROM restaurant_areas WHERE location_id = :l AND id IN ($in))");
                $this->db->bind(':l', $loc);
                $this->db->execute();
                $this->db->query("DELETE FROM restaurant_areas WHERE location_id = :l AND id IN ($in)");
                $this->db->bind(':l', $loc);
                $this->db->execute();
            }

            foreach (array_values($areas) as $i => $a) {
                $name = mb_substr(trim((string)($a['name'] ?? '')), 0, 60) ?: 'Area ' . ($i + 1);
                $w = self::int($a['width'] ?? 1200, 400, 4000, 1200);
                $h = self::int($a['height'] ?? 800, 300, 4000, 800);
                $areaId = (int)($a['id'] ?? 0);
                if ($areaId) {
                    $this->db->query("UPDATE restaurant_areas SET name = :n, sort_order = :s, width = :w, height = :h WHERE id = :id AND location_id = :l");
                    $this->db->bind(':id', $areaId);
                } else {
                    $this->db->query("INSERT INTO restaurant_areas (location_id, name, sort_order, width, height) VALUES (:l, :n, :s, :w, :h)");
                }
                $this->db->bind(':l', $loc);
                $this->db->bind(':n', $name);
                $this->db->bind(':s', $i);
                $this->db->bind(':w', $w);
                $this->db->bind(':h', $h);
                $this->db->execute();
                if (!$areaId) $areaId = (int)$this->db->lastInsertId();

                foreach ((array)($a['tables'] ?? []) as $t) {
                    $vals = [
                        ':n' => mb_substr(trim((string)$t['name']), 0, 50),
                        ':a' => $areaId,
                        ':x' => self::int($t['pos_x'] ?? 0, 0, $w, 0),
                        ':y' => self::int($t['pos_y'] ?? 0, 0, $h, 0),
                        ':w' => self::int($t['width'] ?? 90, 40, 600, 90),
                        ':h' => self::int($t['height'] ?? 90, 40, 600, 90),
                        ':r' => self::int($t['rotation'] ?? 0, 0, 359, 0),
                        ':sh' => in_array($t['shape'] ?? '', self::SHAPES, true) ? $t['shape'] : 'square',
                        ':se' => self::int($t['seats'] ?? 4, 1, 50, 4),
                        ':l' => $loc,
                    ];
                    $tid = (int)($t['id'] ?? 0);
                    if ($tid) {
                        $this->db->query("UPDATE restaurant_tables SET name = :n, area_id = :a, pos_x = :x, pos_y = :y, width = :w, height = :h,
                            rotation = :r, shape = :sh, seats = :se WHERE id = :id AND location_id = :l");
                        $this->db->bind(':id', $tid);
                    } else {
                        $this->db->query("INSERT INTO restaurant_tables (name, location_id, status, area_id, pos_x, pos_y, width, height, rotation, shape, seats)
                            VALUES (:n, :l, 'Available', :a, :x, :y, :w, :h, :r, :sh, :se)");
                    }
                    foreach ($vals as $k => $v) $this->db->bind($k, $v);
                    $this->db->execute();
                }

                // Drawing objects are few: replace them all for the area
                $this->db->query("DELETE FROM restaurant_layout_objects WHERE area_id = :a");
                $this->db->bind(':a', $areaId);
                $this->db->execute();
                foreach ((array)($a['objects'] ?? []) as $o) {
                    $this->db->query("INSERT INTO restaurant_layout_objects (area_id, kind, label, pos_x, pos_y, width, height, rotation)
                        VALUES (:a, :k, :lb, :x, :y, :w, :h, :r)");
                    $this->db->bind(':a', $areaId);
                    $this->db->bind(':k', in_array($o['kind'] ?? '', self::OBJECT_KINDS, true) ? $o['kind'] : 'wall');
                    $this->db->bind(':lb', mb_substr(trim((string)($o['label'] ?? '')), 0, 60) ?: null);
                    $this->db->bind(':x', self::int($o['pos_x'] ?? 0, 0, $w, 0));
                    $this->db->bind(':y', self::int($o['pos_y'] ?? 0, 0, $h, 0));
                    $this->db->bind(':w', self::int($o['width'] ?? 120, 8, 4000, 120));
                    $this->db->bind(':h', self::int($o['height'] ?? 12, 8, 4000, 12));
                    $this->db->bind(':r', self::int($o['rotation'] ?? 0, 0, 359, 0));
                    $this->db->execute();
                }
            }

            $this->db->commit();
        } catch (Throwable $e) {
            try { $this->db->rollBack(); } catch (Throwable $ignored) {}
            error_log('Floor save: ' . $e->getMessage());
            $this->error('Could not save the floor plan. Try again.', 500);
            return;
        }
        $this->success(null, 'Floor plan saved');
    }
}
