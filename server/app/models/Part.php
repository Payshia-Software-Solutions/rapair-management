<?php
/**
 * Part (Item Master) Model
 */
class Part extends Model {
    private $table = 'parts';

    private function ensureSchema() {
        InventorySchema::ensure();
    }

    public function list($q = '') {
        $this->ensureSchema();
        $q = is_string($q) ? trim($q) : '';
        if ($q !== '') {
            $this->db->query("
                SELECT *
                FROM {$this->table}
                WHERE (part_name LIKE :q OR sku LIKE :q OR part_number LIKE :q OR barcode_number LIKE :q)
                ORDER BY part_name ASC
            ");
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }
        $this->db->query("SELECT * FROM {$this->table} ORDER BY part_name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            INSERT INTO {$this->table}
            (sku, part_number, barcode_number, part_name, unit, stock_quantity, cost_price, price, reorder_level, is_active, image_filename, created_by, updated_by)
            VALUES
            (:sku, :part_number, :barcode_number, :part_name, :unit, :stock_quantity, :cost_price, :price, :reorder_level, :is_active, :image_filename, :created_by, :updated_by)
        ");
        $this->db->bind(':sku', $data['sku'] ?? null);
        $this->db->bind(':part_number', $data['part_number'] ?? null);
        $this->db->bind(':barcode_number', $data['barcode_number'] ?? null);
        $this->db->bind(':part_name', $data['part_name']);
        $this->db->bind(':unit', $data['unit'] ?? null);
        $this->db->bind(':stock_quantity', isset($data['stock_quantity']) ? round((float)$data['stock_quantity'], 3) : 0.000);
        $this->db->bind(':cost_price', $data['cost_price'] ?? null);
        $this->db->bind(':price', $data['price']);
        $this->db->bind(':reorder_level', $data['reorder_level'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            UPDATE {$this->table}
            SET sku = :sku,
                part_number = :part_number,
                barcode_number = :barcode_number,
                part_name = :part_name,
                unit = :unit,
                cost_price = :cost_price,
                price = :price,
                reorder_level = :reorder_level,
                is_active = :is_active,
                image_filename = :image_filename,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':sku', $data['sku'] ?? null);
        $this->db->bind(':part_number', $data['part_number'] ?? null);
        $this->db->bind(':barcode_number', $data['barcode_number'] ?? null);
        $this->db->bind(':part_name', $data['part_name']);
        $this->db->bind(':unit', $data['unit'] ?? null);
        $this->db->bind(':cost_price', $data['cost_price'] ?? null);
        $this->db->bind(':price', $data['price']);
        $this->db->bind(':reorder_level', $data['reorder_level'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function setImage($id, $filename, $userId = null) {
        $this->ensureSchema();
        $this->db->query("UPDATE {$this->table} SET image_filename = :fn, updated_by = :u WHERE id = :id");
        $this->db->bind(':fn', $filename);
        $this->db->bind(':u', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->ensureSchema();
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function adjustStock($partId, $qtyChange, $notes = null, $userId = null) {
        $this->ensureSchema();
        $pid = (int)$partId;
        $delta = (int)$qtyChange;
        if ($pid <= 0 || $delta === 0) return false;

        try {
            $this->db->exec("START TRANSACTION");

            // lock row
            $this->db->query("SELECT stock_quantity FROM {$this->table} WHERE id = :id FOR UPDATE");
            $this->db->bind(':id', $pid);
            $row = $this->db->single();
            if (!$row) {
                $this->db->exec("ROLLBACK");
                return false;
            }
            $current = (int)($row->stock_quantity ?? 0);
            $next = $current + $delta;
            if ($next < 0) {
                $this->db->exec("ROLLBACK");
                return false;
            }

            $this->db->query("UPDATE {$this->table} SET stock_quantity = :q, updated_by = :u WHERE id = :id");
            $this->db->bind(':q', $next);
            $this->db->bind(':u', $userId);
            $this->db->bind(':id', $pid);
            $this->db->execute();

            // movement
            $this->db->query("
                INSERT INTO stock_movements (part_id, qty_change, movement_type, ref_table, ref_id, notes, created_by)
                VALUES (:part_id, :qty_change, 'ADJUSTMENT', 'parts', :ref_id, :notes, :created_by)
            ");
            $this->db->bind(':part_id', $pid);
            $this->db->bind(':qty_change', $delta);
            $this->db->bind(':ref_id', $pid);
            $this->db->bind(':notes', $notes);
            $this->db->bind(':created_by', $userId);
            $this->db->execute();

            $this->db->exec("COMMIT");
            return true;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function listMovements($partId, $limit = 200) {
        $this->ensureSchema();
        $pid = (int)$partId;
        $lim = (int)$limit;
        if ($lim <= 0) $lim = 200;
        if ($lim > 1000) $lim = 1000;

        $this->db->query("
            SELECT sm.*, p.part_name, p.sku
            FROM stock_movements sm
            INNER JOIN parts p ON p.id = sm.part_id
            WHERE sm.part_id = :pid
            ORDER BY sm.id DESC
            LIMIT {$lim}
        ");
        $this->db->bind(':pid', $pid);
        return $this->db->resultSet();
    }
}
