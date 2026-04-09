<?php
/**
 * OrderPart Model - parts issued to a repair order.
 */
class OrderPart extends Model {
    private function ensureSchema() {
        InventorySchema::ensure();
    }

    public function listByOrder($orderId) {
        $this->ensureSchema();
        $oid = (int)$orderId;
        $this->db->query("
            SELECT op.*, p.part_name, p.sku, p.unit
            FROM order_parts op
            INNER JOIN parts p ON p.id = op.part_id
            WHERE op.order_id = :oid
            ORDER BY op.id ASC
        ");
        $this->db->bind(':oid', $oid);
        return $this->db->resultSet();
    }

    public function addLine($orderId, $partId, $qty, $userId = null) {
        $this->ensureSchema();
        $oid = (int)$orderId;
        $pid = (int)$partId;
        $qty = (int)$qty;
        if ($oid <= 0 || $pid <= 0 || $qty <= 0) return false;

        try {
            $this->db->exec("START TRANSACTION");

            // Lock part
            $this->db->query("SELECT stock_quantity, cost_price, price FROM parts WHERE id = :id FOR UPDATE");
            $this->db->bind(':id', $pid);
            $p = $this->db->single();
            if (!$p) {
                $this->db->exec("ROLLBACK");
                return false;
            }

            $stock = (int)($p->stock_quantity ?? 0);
            if ($stock < $qty) {
                $this->db->exec("ROLLBACK");
                return ['error' => 'Insufficient stock'];
            }

            $unitCost = $p->cost_price !== null ? (float)$p->cost_price : null;
            $unitPrice = $p->price !== null ? (float)$p->price : null;
            $lineTotal = ($unitPrice !== null) ? round($unitPrice * $qty, 2) : null;

            // Deduct stock
            $this->db->query("UPDATE parts SET stock_quantity = stock_quantity - :qty, updated_by = :u WHERE id = :id");
            $this->db->bind(':qty', $qty);
            $this->db->bind(':u', $userId);
            $this->db->bind(':id', $pid);
            $this->db->execute();

            // Create order part line
            $this->db->query("
                INSERT INTO order_parts (order_id, part_id, quantity, unit_cost, unit_price, line_total, created_by, updated_by)
                VALUES (:order_id, :part_id, :qty, :unit_cost, :unit_price, :line_total, :created_by, :updated_by)
            ");
            $this->db->bind(':order_id', $oid);
            $this->db->bind(':part_id', $pid);
            $this->db->bind(':qty', $qty);
            $this->db->bind(':unit_cost', $unitCost);
            $this->db->bind(':unit_price', $unitPrice);
            $this->db->bind(':line_total', $lineTotal);
            $this->db->bind(':created_by', $userId);
            $this->db->bind(':updated_by', $userId);
            $this->db->execute();
            $lineId = (int)$this->db->lastInsertId();

            // Stock movement ledger
            $this->db->query("
                INSERT INTO stock_movements (part_id, qty_change, movement_type, ref_table, ref_id, unit_cost, unit_price, notes, created_by)
                VALUES (:part_id, :qty_change, 'ORDER_ISSUE', 'repair_orders', :ref_id, :unit_cost, :unit_price, :notes, :created_by)
            ");
            $this->db->bind(':part_id', $pid);
            $this->db->bind(':qty_change', -1 * $qty);
            $this->db->bind(':ref_id', $oid);
            $this->db->bind(':unit_cost', $unitCost);
            $this->db->bind(':unit_price', $unitPrice);
            $this->db->bind(':notes', 'Issue to order');
            $this->db->bind(':created_by', $userId);
            $this->db->execute();

            $this->db->exec("COMMIT");
            return $lineId;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function updateQty($lineId, $newQty, $userId = null) {
        $this->ensureSchema();
        $lid = (int)$lineId;
        $newQty = (int)$newQty;
        if ($lid <= 0 || $newQty <= 0) return false;

        try {
            $this->db->exec("START TRANSACTION");

            $this->db->query("SELECT id, order_id, part_id, quantity, unit_cost, unit_price FROM order_parts WHERE id = :id FOR UPDATE");
            $this->db->bind(':id', $lid);
            $line = $this->db->single();
            if (!$line) {
                $this->db->exec("ROLLBACK");
                return false;
            }

            $oldQty = (int)($line->quantity ?? 0);
            $diff = $newQty - $oldQty;
            if ($diff === 0) {
                $this->db->exec("COMMIT");
                return true;
            }

            $pid = (int)$line->part_id;
            $oid = (int)$line->order_id;

            // Adjust stock based on diff
            if ($diff > 0) {
                $this->db->query("SELECT stock_quantity FROM parts WHERE id = :id FOR UPDATE");
                $this->db->bind(':id', $pid);
                $p = $this->db->single();
                $stock = (int)($p->stock_quantity ?? 0);
                if ($stock < $diff) {
                    $this->db->exec("ROLLBACK");
                    return ['error' => 'Insufficient stock'];
                }
                $this->db->query("UPDATE parts SET stock_quantity = stock_quantity - :qty, updated_by = :u WHERE id = :id");
                $this->db->bind(':qty', $diff);
                $this->db->bind(':u', $userId);
                $this->db->bind(':id', $pid);
                $this->db->execute();
            } else {
                $this->db->query("UPDATE parts SET stock_quantity = stock_quantity + :qty, updated_by = :u WHERE id = :id");
                $this->db->bind(':qty', -1 * $diff);
                $this->db->bind(':u', $userId);
                $this->db->bind(':id', $pid);
                $this->db->execute();
            }

            $unitPrice = $line->unit_price !== null ? (float)$line->unit_price : null;
            $lineTotal = ($unitPrice !== null) ? round($unitPrice * $newQty, 2) : null;

            $this->db->query("UPDATE order_parts SET quantity = :q, line_total = :t, updated_by = :u WHERE id = :id");
            $this->db->bind(':q', $newQty);
            $this->db->bind(':t', $lineTotal);
            $this->db->bind(':u', $userId);
            $this->db->bind(':id', $lid);
            $this->db->execute();

            // Stock movement record for the diff
            $this->db->query("
                INSERT INTO stock_movements (part_id, qty_change, movement_type, ref_table, ref_id, unit_cost, unit_price, notes, created_by)
                VALUES (:part_id, :qty_change, 'ORDER_ISSUE', 'repair_orders', :ref_id, :unit_cost, :unit_price, :notes, :created_by)
            ");
            $this->db->bind(':part_id', $pid);
            $this->db->bind(':qty_change', -1 * $diff); // if diff>0: more issue(-), diff<0: return(+)
            $this->db->bind(':ref_id', $oid);
            $this->db->bind(':unit_cost', $line->unit_cost !== null ? (float)$line->unit_cost : null);
            $this->db->bind(':unit_price', $unitPrice);
            $this->db->bind(':notes', 'Update issued qty');
            $this->db->bind(':created_by', $userId);
            $this->db->execute();

            $this->db->exec("COMMIT");
            return true;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function deleteLine($lineId, $userId = null) {
        $this->ensureSchema();
        $lid = (int)$lineId;
        if ($lid <= 0) return false;

        try {
            $this->db->exec("START TRANSACTION");

            $this->db->query("SELECT id, order_id, part_id, quantity, unit_cost, unit_price FROM order_parts WHERE id = :id FOR UPDATE");
            $this->db->bind(':id', $lid);
            $line = $this->db->single();
            if (!$line) {
                $this->db->exec("ROLLBACK");
                return false;
            }

            $pid = (int)$line->part_id;
            $oid = (int)$line->order_id;
            $qty = (int)$line->quantity;

            // return stock
            $this->db->query("UPDATE parts SET stock_quantity = stock_quantity + :qty, updated_by = :u WHERE id = :id");
            $this->db->bind(':qty', $qty);
            $this->db->bind(':u', $userId);
            $this->db->bind(':id', $pid);
            $this->db->execute();

            $this->db->query("DELETE FROM order_parts WHERE id = :id");
            $this->db->bind(':id', $lid);
            $this->db->execute();

            $this->db->query("
                INSERT INTO stock_movements (part_id, qty_change, movement_type, ref_table, ref_id, unit_cost, unit_price, notes, created_by)
                VALUES (:part_id, :qty_change, 'ORDER_ISSUE', 'repair_orders', :ref_id, :unit_cost, :unit_price, :notes, :created_by)
            ");
            $this->db->bind(':part_id', $pid);
            $this->db->bind(':qty_change', $qty);
            $this->db->bind(':ref_id', $oid);
            $this->db->bind(':unit_cost', $line->unit_cost !== null ? (float)$line->unit_cost : null);
            $this->db->bind(':unit_price', $line->unit_price !== null ? (float)$line->unit_price : null);
            $this->db->bind(':notes', 'Return from order');
            $this->db->bind(':created_by', $userId);
            $this->db->execute();

            $this->db->exec("COMMIT");
            return true;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function getLine($lineId) {
        $this->ensureSchema();
        $lid = (int)$lineId;
        $this->db->query("SELECT * FROM order_parts WHERE id = :id LIMIT 1");
        $this->db->bind(':id', $lid);
        return $this->db->single();
    }
}

