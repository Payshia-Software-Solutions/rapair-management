<?php
/**
 * Part (Item Master) Model
 */
class Part extends Model {
    private $table = 'parts';

    private function ensureSchema() {
        InventorySchema::ensure();
    }

    public function getLocationStock($partId, $locationId) {
        $this->ensureSchema();
        $pid = (int)$partId;
        $loc = (int)$locationId;
        if ($pid <= 0 || $loc <= 0) return null;

        // Base on-hand: use stock_movements ledger when present for this part+location.
        // If no ledger history exists, fall back to parts.stock_quantity (older installs).
        $onHand = null;
        try {
            $this->db->query("
                SELECT COUNT(*) AS c, COALESCE(SUM(qty_change), 0) AS qty
                FROM stock_movements
                WHERE location_id = :loc AND part_id = :pid
            ");
            $this->db->bind(':loc', $loc);
            $this->db->bind(':pid', $pid);
            $row = $this->db->single();
            $cnt = (int)($row->c ?? 0);
            if ($cnt > 0) $onHand = (float)($row->qty ?? 0);
        } catch (Exception $e) {
            $onHand = null;
        }

        if ($onHand === null) {
            try {
                $this->db->query("SELECT stock_quantity FROM {$this->table} WHERE id = :id LIMIT 1");
                $this->db->bind(':id', $pid);
                $row = $this->db->single();
                $onHand = (float)($row->stock_quantity ?? 0);
            } catch (Exception $e) {
                $onHand = 0.0;
            }
        }

        // Reserved qty in pending (Requested) transfers from this location.
        $reserved = 0.0;
        try {
            $this->db->query("
                SELECT COALESCE(SUM(i.qty), 0) AS reserved
                FROM stock_transfer_requests r
                INNER JOIN stock_transfer_items i ON i.transfer_id = r.id
                WHERE r.status = 'Requested' AND r.from_location_id = :loc AND i.part_id = :pid
            ");
            $this->db->bind(':loc', $loc);
            $this->db->bind(':pid', $pid);
            $row = $this->db->single();
            $reserved = (float)($row->reserved ?? 0);
        } catch (Exception $e) {
            $reserved = 0.0;
        }

        $available = (float)$onHand - (float)$reserved;

        return (object)[
            'part_id' => $pid,
            'location_id' => $loc,
            'on_hand' => round((float)$onHand, 3),
            'reserved' => round((float)$reserved, 3),
            'available' => round((float)$available, 3),
        ];
    }

    public function list($q = '', $supplierId = null) {
        $this->ensureSchema();
        $q = is_string($q) ? trim($q) : '';
        $sid = $supplierId !== null ? (int)$supplierId : 0;

        $from = "{$this->table} p";
        $whereSupplier = "";
        if ($sid > 0) {
            // Show only items explicitly assigned to the supplier.
            $from .= " INNER JOIN part_suppliers ps ON ps.part_id = p.id AND ps.supplier_id = :sid";
            $whereSupplier = "1=1";
        }

        if ($q !== '') {
            $this->db->query("
                SELECT p.*, b.name AS brand_name
                FROM {$from}
                LEFT JOIN brands b ON b.id = p.brand_id
                WHERE " . ($whereSupplier !== "" ? "{$whereSupplier} AND " : "") . " (p.part_name LIKE :q OR p.sku LIKE :q OR p.part_number LIKE :q OR p.barcode_number LIKE :q)
                ORDER BY p.part_name ASC
            ");
            if ($sid > 0) $this->db->bind(':sid', $sid);
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }
        $this->db->query("
            SELECT p.*, b.name AS brand_name
            FROM {$from}
            LEFT JOIN brands b ON b.id = p.brand_id
            ORDER BY p.part_name ASC
        ");
        if ($sid > 0) $this->db->bind(':sid', $sid);
        return $this->db->resultSet();
    }

    public function listLocationBalances($locationId, $q = '') {
        $this->ensureSchema();
        $locId = (int)$locationId;
        if ($locId <= 0) $locId = 1;
        $q = is_string($q) ? trim($q) : '';

        // Location-wise balance uses stock_movements ledger. We also return system_stock_quantity
        // so older installs without movements are still understandable in the UI.
        $sqlBase = "
            SELECT p.id,
                   p.part_name,
                   p.sku,
                   p.unit,
                   p.brand_id,
                   b.name AS brand_name,
                   p.cost_price,
                   p.price,
                   p.reorder_level,
                   p.is_active,
                   p.stock_quantity AS system_stock_quantity,
                   COALESCE(SUM(sm.qty_change), 0) AS location_stock_quantity
            FROM {$this->table} p
            LEFT JOIN brands b ON b.id = p.brand_id
            LEFT JOIN stock_movements sm ON sm.part_id = p.id AND sm.location_id = :loc
        ";

        if ($q !== '') {
            $this->db->query($sqlBase . "
                WHERE (p.part_name LIKE :q OR p.sku LIKE :q OR p.part_number LIKE :q OR p.barcode_number LIKE :q)
                GROUP BY p.id
                ORDER BY p.part_name ASC
            ");
            $this->db->bind(':loc', $locId);
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }

        $this->db->query($sqlBase . "
            GROUP BY p.id
            ORDER BY p.part_name ASC
        ");
        $this->db->bind(':loc', $locId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("
            SELECT p.*, b.name AS brand_name
            FROM {$this->table} p
            LEFT JOIN brands b ON b.id = p.brand_id
            WHERE p.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        $row = $this->db->single();
        if (!$row) return null;

        // Supplier mapping
        $this->db->query("
            SELECT s.id, s.name
            FROM part_suppliers ps
            INNER JOIN suppliers s ON s.id = ps.supplier_id
            WHERE ps.part_id = :id
            ORDER BY s.name ASC
        ");
        $this->db->bind(':id', (int)$id);
        $suppliers = $this->db->resultSet();
        $supplierIds = [];
        if (is_array($suppliers)) {
            foreach ($suppliers as $s) {
                $supplierIds[] = (int)($s->id ?? 0);
            }
        }
        $row->supplier_ids = $supplierIds;
        $row->suppliers = $suppliers;
        return $row;
    }

    public function setSuppliers($partId, $supplierIds, $userId = null) {
        $this->ensureSchema();
        $pid = (int)$partId;
        if ($pid <= 0) return false;
        $ids = is_array($supplierIds) ? $supplierIds : [];
        $norm = [];
        foreach ($ids as $v) {
            $sid = (int)$v;
            if ($sid > 0) $norm[$sid] = true;
        }
        $uniqueIds = array_keys($norm);

        try {
            $this->db->exec("START TRANSACTION");
            $this->db->query("DELETE FROM part_suppliers WHERE part_id = :pid");
            $this->db->bind(':pid', $pid);
            $this->db->execute();

            foreach ($uniqueIds as $sid) {
                $this->db->query("
                    INSERT IGNORE INTO part_suppliers (part_id, supplier_id, created_by)
                    VALUES (:pid, :sid, :u)
                ");
                $this->db->bind(':pid', $pid);
                $this->db->bind(':sid', (int)$sid);
                $this->db->bind(':u', $userId);
                $this->db->execute();
            }

            $this->db->exec("COMMIT");
            return true;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function create($data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            INSERT INTO {$this->table}
            (sku, part_number, barcode_number, part_name, unit, brand_id, stock_quantity, cost_price, price, reorder_level, is_active, image_filename, item_type, created_by, updated_by)
            VALUES
            (:sku, :part_number, :barcode_number, :part_name, :unit, :brand_id, :stock_quantity, :cost_price, :price, :reorder_level, :is_active, :image_filename, :item_type, :created_by, :updated_by)
        ");
        $this->db->bind(':sku', $data['sku'] ?? null);
        $this->db->bind(':part_number', $data['part_number'] ?? null);
        $this->db->bind(':barcode_number', $data['barcode_number'] ?? null);
        $this->db->bind(':part_name', $data['part_name']);
        $this->db->bind(':unit', $data['unit'] ?? null);
        $this->db->bind(':brand_id', isset($data['brand_id']) && (int)$data['brand_id'] > 0 ? (int)$data['brand_id'] : null);
        $this->db->bind(':stock_quantity', isset($data['stock_quantity']) ? round((float)$data['stock_quantity'], 3) : 0.000);
        $this->db->bind(':cost_price', $data['cost_price'] ?? null);
        $this->db->bind(':price', $data['price']);
        $this->db->bind(':reorder_level', $data['reorder_level'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':item_type', $data['item_type'] ?? 'Part');
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        $ok = $this->db->execute();
        if (!$ok) return false;
        return (int)$this->db->lastInsertId();
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
                brand_id = :brand_id,
                cost_price = :cost_price,
                price = :price,
                reorder_level = :reorder_level,
                is_active = :is_active,
                image_filename = :image_filename,
                item_type = :item_type,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':sku', $data['sku'] ?? null);
        $this->db->bind(':part_number', $data['part_number'] ?? null);
        $this->db->bind(':barcode_number', $data['barcode_number'] ?? null);
        $this->db->bind(':part_name', $data['part_name']);
        $this->db->bind(':unit', $data['unit'] ?? null);
        $this->db->bind(':brand_id', isset($data['brand_id']) && (int)$data['brand_id'] > 0 ? (int)$data['brand_id'] : null);
        $this->db->bind(':cost_price', $data['cost_price'] ?? null);
        $this->db->bind(':price', $data['price']);
        $this->db->bind(':reorder_level', $data['reorder_level'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':item_type', $data['item_type'] ?? 'Part');
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

    public function listMovements($partId, $limit = 200, $locationId = 0, $from = null, $to = null) {
        $this->ensureSchema();
        $pid = (int)$partId;
        $lim = (int)$limit;
        if ($lim <= 0) $lim = 200;
        if ($lim > 1000) $lim = 1000;
        $locId = (int)$locationId;
        if ($locId < 0) $locId = 0;
        $fromDt = is_string($from) && trim($from) !== '' ? trim($from) : null;
        $toDt = is_string($to) && trim($to) !== '' ? trim($to) : null;

        $where = "WHERE sm.part_id = :pid AND (:loc = 0 OR sm.location_id = :loc)";
        if ($fromDt) $where .= " AND sm.created_at >= :from_dt";
        if ($toDt) $where .= " AND sm.created_at <= :to_dt";

        $this->db->query("
            SELECT sm.*,
                   p.part_name, p.sku,
                   sl.name AS location_name,
                   grn.grn_number,
                   grn.received_at AS grn_received_at,
                   s1.name AS grn_supplier_name,
                   po.po_number AS grn_po_number,
                   sa.adjustment_number,
                   sa.adjusted_at AS adjustment_at,
                   sa.reason AS adjustment_reason,
                   ro.vehicle_identifier,
                   ro.vehicle_model,
                   ro.priority AS order_priority,
                   ro.status AS order_status,
                   ro.expected_time AS order_expected_time,
                   tr.transfer_number,
                   tr.from_location_id AS transfer_from_location_id,
                   tr.to_location_id AS transfer_to_location_id,
                   lf.name AS transfer_from_location_name,
                   lt.name AS transfer_to_location_name,
                   CASE
                     WHEN sm.ref_table = 'goods_receive_notes' THEN grn.grn_number
                     WHEN sm.ref_table = 'stock_adjustments' THEN sa.adjustment_number
                     WHEN sm.ref_table = 'repair_orders' THEN COALESCE(ro.vehicle_identifier, CONCAT('Order #', sm.ref_id))
                     WHEN sm.ref_table = 'stock_transfer_requests' THEN tr.transfer_number
                     ELSE CONCAT(COALESCE(sm.ref_table,''), '#', COALESCE(sm.ref_id,''))
                   END AS ref_label,
                   CASE
                     WHEN sm.ref_table = 'goods_receive_notes' THEN CONCAT('/inventory/grn/print/', sm.ref_id)
                     WHEN sm.ref_table = 'stock_adjustments' THEN CONCAT('/inventory/stock/adjustments/print/', sm.ref_id)
                     WHEN sm.ref_table = 'repair_orders' THEN CONCAT('/orders/', sm.ref_id)
                     WHEN sm.ref_table = 'stock_transfer_requests' THEN CONCAT('/inventory/transfers/', sm.ref_id)
                     ELSE NULL
                   END AS ref_url,
                   CASE
                     WHEN sm.ref_table = 'goods_receive_notes' THEN 'GRN'
                     WHEN sm.ref_table = 'stock_adjustments' THEN 'Stock Adjustment'
                     WHEN sm.ref_table = 'repair_orders' THEN 'Repair Order'
                     WHEN sm.ref_table = 'stock_transfer_requests' THEN 'Stock Transfer'
                     ELSE NULL
                   END AS ref_type
            FROM stock_movements sm
            INNER JOIN parts p ON p.id = sm.part_id
            LEFT JOIN service_locations sl ON sl.id = sm.location_id
            LEFT JOIN goods_receive_notes grn ON sm.ref_table = 'goods_receive_notes' AND grn.id = sm.ref_id
            LEFT JOIN suppliers s1 ON s1.id = grn.supplier_id
            LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
            LEFT JOIN stock_adjustments sa ON sm.ref_table = 'stock_adjustments' AND sa.id = sm.ref_id
            LEFT JOIN repair_orders ro ON sm.ref_table = 'repair_orders' AND ro.id = sm.ref_id
            LEFT JOIN stock_transfer_requests tr ON sm.ref_table = 'stock_transfer_requests' AND tr.id = sm.ref_id
            LEFT JOIN service_locations lf ON lf.id = tr.from_location_id
            LEFT JOIN service_locations lt ON lt.id = tr.to_location_id
            {$where}
            ORDER BY sm.id DESC
            LIMIT {$lim}
        ");
        $this->db->bind(':pid', $pid);
        $this->db->bind(':loc', $locId);
        if ($fromDt) $this->db->bind(':from_dt', $fromDt);
        if ($toDt) $this->db->bind(':to_dt', $toDt);
        return $this->db->resultSet();
    }
}
