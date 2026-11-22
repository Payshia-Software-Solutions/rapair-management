<?php
/**
 * Selling price lists: /api/pricelist/...
 *   list, save, delete/{id}          lists (name, parent, +/-%, rounding)
 *   items?list_id=&q=&category=&collection=&only_set=&page=   items with Standard, inherited and own price
 *   set_items { list_id, items: [{ part_id, price|null }] }   set / clear own prices
 */
require_once '../app/helpers/PriceListHelper.php';

class PricelistController extends Controller {
    protected $db;

    public function __construct() { $this->db = new Database(); }

    private function body() { return json_decode(file_get_contents('php://input'), true) ?: []; }

    // GET /api/pricelist/list
    public function list() {
        $this->requireAuth();
        $this->db->query("
            SELECT l.*, p.name AS parent_name,
                   (SELECT COUNT(*) FROM price_list_items i WHERE i.price_list_id = l.id) AS item_count,
                   (SELECT GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ', ') FROM service_locations s WHERE s.price_list_id = l.id) AS locations
            FROM price_lists l LEFT JOIN price_lists p ON p.id = l.parent_id
            ORDER BY l.name
        ");
        $this->success($this->db->resultSet() ?: []);
    }

    // POST /api/pricelist/save { id?, name, parent_id, adjust_percent, round_to, is_active }
    public function save() {
        $this->requirePermission('parts.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $id = (int)($d['id'] ?? 0);
        $name = trim(mb_substr((string)($d['name'] ?? ''), 0, 100));
        if ($name === '') { $this->error('Name is required', 422); return; }
        $parent = (int)($d['parent_id'] ?? 0) ?: null;
        if ($parent && $id && $parent === $id) { $this->error('A list cannot inherit from itself', 422); return; }
        if ($parent && $id) {
            // no loops: the new parent must not inherit (directly or not) from this list
            foreach (PriceListHelper::chain($this->db, $parent) as $l) {
                if ((int)$l->id === $id) { $this->error('That parent already inherits from this list', 422); return; }
            }
        }
        $adj = max(-90, min(500, round((float)($d['adjust_percent'] ?? 0), 3)));
        $round = max(0, round((float)($d['round_to'] ?? 0), 2));
        $active = array_key_exists('is_active', $d) ? (!empty($d['is_active']) ? 1 : 0) : 1;
        if ($id > 0) {
            $this->db->query("UPDATE price_lists SET name=:n, parent_id=:p, adjust_percent=:a, round_to=:r, is_active=:act WHERE id=:id");
            $this->db->bind(':id', $id);
        } else {
            $this->db->query("INSERT INTO price_lists (name, parent_id, adjust_percent, round_to, is_active) VALUES (:n,:p,:a,:r,:act)");
        }
        $this->db->bind(':n', $name); $this->db->bind(':p', $parent); $this->db->bind(':a', $adj);
        $this->db->bind(':r', $round); $this->db->bind(':act', $active);
        $this->db->execute();
        $this->success(['id' => $id > 0 ? $id : (int)$this->db->lastInsertId()], 'Price list saved');
    }

    // POST /api/pricelist/delete/{id}  -> locations go back to Standard, children inherit from its parent
    public function delete($id = null) {
        $this->requirePermission('parts.write');
        $id = (int)$id;
        $this->db->query("SELECT parent_id FROM price_lists WHERE id = :id"); $this->db->bind(':id', $id);
        $row = $this->db->single();
        if (!$row) { $this->error('Not found', 404); return; }
        $this->db->query("UPDATE price_lists SET parent_id = :p WHERE parent_id = :id"); $this->db->bind(':p', $row->parent_id); $this->db->bind(':id', $id); $this->db->execute();
        $this->db->query("UPDATE service_locations SET price_list_id = NULL WHERE price_list_id = :id"); $this->db->bind(':id', $id); $this->db->execute();
        $this->db->query("DELETE FROM price_list_items WHERE price_list_id = :id"); $this->db->bind(':id', $id); $this->db->execute();
        $this->db->query("DELETE FROM price_lists WHERE id = :id"); $this->db->bind(':id', $id); $this->db->execute();
        $this->success(null, 'Price list deleted');
    }

    // GET /api/pricelist/items?list_id=&q=&category=&collection=&only_set=1&page=
    public function items() {
        $this->requireAuth();
        $listId = (int)($_GET['list_id'] ?? 0);
        $chain = PriceListHelper::chain($this->db, $listId);
        if (!$chain) { $this->error('Price list not found or inactive', 404); return; }
        $q = trim((string)($_GET['q'] ?? ''));
        $page = max(1, (int)($_GET['page'] ?? 1)); $per = 50;
        $where = ["p.is_active = 1"];
        if ($q !== '') $where[] = "(p.part_name LIKE :q1 OR p.sku LIKE :q2 OR p.barcode_number LIKE :q3)";
        if ((int)($_GET['category'] ?? 0) > 0) $where[] = "p.item_category_id = " . (int)$_GET['category'];
        if ((int)($_GET['collection'] ?? 0) > 0) $where[] = "EXISTS (SELECT 1 FROM parts_collections pc WHERE pc.part_id = p.id AND pc.collection_id = " . (int)$_GET['collection'] . ")";
        if (!empty($_GET['only_set'])) $where[] = "EXISTS (SELECT 1 FROM price_list_items i WHERE i.part_id = p.id AND i.price_list_id = " . $listId . ")";
        $w = implode(' AND ', $where);
        $bindQ = function () use ($q) { if ($q !== '') foreach ([':q1', ':q2', ':q3'] as $k) $this->db->bind($k, '%' . $q . '%'); };

        $this->db->query("SELECT COUNT(*) AS c FROM parts p WHERE $w"); $bindQ();
        $total = (int)$this->db->single()->c;
        $this->db->query("SELECT p.id, p.part_name, p.sku, p.price FROM parts p WHERE $w ORDER BY p.part_name LIMIT $per OFFSET " . (($page - 1) * $per)); $bindQ();
        $rows = $this->db->resultSet() ?: [];

        $ids = array_map(function ($r) { return (int)$r->id; }, $rows);
        $explicit = PriceListHelper::explicitPrices($this->db, array_map(function ($l) { return $l->id; }, $chain), $ids);
        $parentChain = array_slice($chain, 1);
        $out = [];
        foreach ($rows as $r) {
            $own = $explicit[$listId][(int)$r->id] ?? null;
            $out[] = [
                'id' => (int)$r->id,
                'part_name' => $r->part_name,
                'sku' => $r->sku,
                'standard_price' => (float)$r->price,
                // what this list would charge without its own price (parent + adjustment)
                'inherited_price' => PriceListHelper::resolve($chain, array_diff_key($explicit, [$listId => 1]), (int)$r->id, (float)$r->price),
                'own_price' => $own,
                'price' => PriceListHelper::resolve($chain, $explicit, (int)$r->id, (float)$r->price),
            ];
        }
        $this->success(['items' => $out, 'total' => $total, 'page' => $page, 'per_page' => $per, 'list' => $chain[0]]);
    }

    // POST /api/pricelist/set_items { list_id, items: [{ part_id, price }] }   price null/'' clears it (inherit again)
    public function set_items() {
        $this->requirePermission('parts.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $listId = (int)($d['list_id'] ?? 0);
        $this->db->query("SELECT id FROM price_lists WHERE id = :id"); $this->db->bind(':id', $listId);
        if (!$this->db->single()) { $this->error('Price list not found', 404); return; }
        $n = 0;
        foreach (array_slice((array)($d['items'] ?? []), 0, 2000) as $it) {
            $pid = (int)($it['part_id'] ?? 0);
            if ($pid <= 0) continue;
            $price = $it['price'] ?? null;
            if ($price === null || $price === '') {
                $this->db->query("DELETE FROM price_list_items WHERE price_list_id = :l AND part_id = :p");
            } else {
                $price = round((float)$price, 2);
                if ($price < 0) continue;
                $this->db->query("INSERT INTO price_list_items (price_list_id, part_id, price) VALUES (:l, :p, :pr)
                                  ON DUPLICATE KEY UPDATE price = VALUES(price)");
                $this->db->bind(':pr', $price);
            }
            $this->db->bind(':l', $listId); $this->db->bind(':p', $pid);
            $this->db->execute();
            $n++;
        }
        $this->success(['updated' => $n], 'Prices saved');
    }
}
