<?php
/**
 * Goods Receive Note (GRN) Model
 */
class GoodsReceiveNote extends Model {
    private $table = 'goods_receive_notes';

    private function ensureSchema() {
        InventorySchema::ensure();
    }

    private function genNumber() {
        $dt = new DateTime('now');
        $stamp = $dt->format('Ymd-His');
        $rand = substr(strtoupper(bin2hex(random_bytes(4))), 0, 8);
        return "GRN-{$stamp}-{$rand}";
    }

    public function list($q = '') {
        $this->ensureSchema();
        $q = is_string($q) ? trim($q) : '';
        if ($q !== '') {
            $this->db->query("
                SELECT g.*, s.name AS supplier_name, po.po_number
                FROM {$this->table} g
                INNER JOIN suppliers s ON s.id = g.supplier_id
                LEFT JOIN purchase_orders po ON po.id = g.purchase_order_id
                WHERE g.grn_number LIKE :q OR s.name LIKE :q OR po.po_number LIKE :q
                ORDER BY g.id DESC
            ");
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }
        $this->db->query("
            SELECT g.*, s.name AS supplier_name, po.po_number
            FROM {$this->table} g
            INNER JOIN suppliers s ON s.id = g.supplier_id
            LEFT JOIN purchase_orders po ON po.id = g.purchase_order_id
            ORDER BY g.id DESC
        ");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("
            SELECT g.*, s.name AS supplier_name, po.po_number
            FROM {$this->table} g
            INNER JOIN suppliers s ON s.id = g.supplier_id
            LEFT JOIN purchase_orders po ON po.id = g.purchase_order_id
            WHERE g.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        $grn = $this->db->single();
        if (!$grn) return null;

        $this->db->query("
            SELECT i.*, p.part_name, p.sku
            FROM grn_items i
            INNER JOIN parts p ON p.id = i.part_id
            WHERE i.grn_id = :id
            ORDER BY i.id ASC
        ");
        $this->db->bind(':id', (int)$id);
        $items = $this->db->resultSet();

        return (object)[
            'grn' => $grn,
            'items' => $items,
        ];
    }

    public function create($data, $userId = null, $locationId = 1) {
        $this->ensureSchema();
        $locId = (int)$locationId;
        if ($locId <= 0) $locId = 1;
        $supplierId = (int)($data['supplier_id'] ?? 0);
        $poId = isset($data['purchase_order_id']) ? (int)$data['purchase_order_id'] : null;
        $receivedAt = $data['received_at'] ?? null;
        $items = isset($data['items']) && is_array($data['items']) ? $data['items'] : [];
        if ($supplierId <= 0 || !$receivedAt || count($items) === 0) return false;

        $grnNumber = trim((string)($data['grn_number'] ?? ''));
        if ($grnNumber === '') $grnNumber = $this->genNumber();

        try {
            $this->db->exec("START TRANSACTION");

            $this->db->query("
                INSERT INTO {$this->table}
                (grn_number, purchase_order_id, supplier_id, received_at, notes, created_by, updated_by)
                VALUES
                (:grn_number, :po_id, :supplier_id, :received_at, :notes, :created_by, :updated_by)
            ");
            $this->db->bind(':grn_number', $grnNumber);
            $this->db->bind(':po_id', $poId);
            $this->db->bind(':supplier_id', $supplierId);
            $this->db->bind(':received_at', $receivedAt);
            $this->db->bind(':notes', $data['notes'] ?? null);
            $this->db->bind(':created_by', $userId);
            $this->db->bind(':updated_by', $userId);
            $ok = $this->db->execute();
            if (!$ok) {
                $this->db->exec("ROLLBACK");
                return false;
            }
            $grnId = (int)$this->db->lastInsertId();

            foreach ($items as $it) {
                $partId = (int)($it['part_id'] ?? $it['partId'] ?? 0);
                $qty = round((float)($it['qty_received'] ?? $it['qty'] ?? 0), 3);
                $unitCost = (float)($it['unit_cost'] ?? $it['unitCost'] ?? 0);
                if ($partId <= 0 || $qty <= 0) continue;
                $lineTotal = round($qty * $unitCost, 2);

                // Insert GRN item
                $this->db->query("
                    INSERT INTO grn_items (grn_id, part_id, qty_received, unit_cost, line_total)
                    VALUES (:grn_id, :part_id, :qty, :unit_cost, :line_total)
                ");
                $this->db->bind(':grn_id', $grnId);
                $this->db->bind(':part_id', $partId);
                $this->db->bind(':qty', $qty);
                $this->db->bind(':unit_cost', $unitCost);
                $this->db->bind(':line_total', $lineTotal);
                $this->db->execute();

                // Increase stock and update avg cost price:
                // avg_cost = (current_qty*current_cost + received_qty*unit_cost) / (current_qty + received_qty)
                $this->db->query("SELECT stock_quantity, cost_price FROM parts WHERE id = :id FOR UPDATE");
                $this->db->bind(':id', $partId);
                $p = $this->db->single();
                if (!$p) {
                    $this->db->exec("ROLLBACK");
                    return false;
                }
                $currentQty = round((float)($p->stock_quantity ?? 0), 3);
                $currentCost = $p->cost_price !== null ? (float)$p->cost_price : (float)$unitCost;
                $receivedQty = (float)$qty;

                $newQty = round($currentQty + $receivedQty, 3);
                $avgCost = (float)$unitCost;
                if ($newQty > 0) {
                    $currentValue = $currentQty > 0 ? ($currentQty * $currentCost) : 0.0;
                    $newValue = $receivedQty * (float)$unitCost;
                    $avgCost = ($currentValue + $newValue) / $newQty;
                }
                $avgCost = round($avgCost, 2); // cost_price is money-like

                $this->db->query("UPDATE parts SET stock_quantity = :qty, cost_price = :avg_cost, updated_by = :u WHERE id = :id");
                $this->db->bind(':qty', $newQty);
                $this->db->bind(':avg_cost', $avgCost);
                $this->db->bind(':u', $userId);
                $this->db->bind(':id', $partId);
                $this->db->execute();

                // Stock movement ledger
                $this->db->query("
                    INSERT INTO stock_movements (location_id, part_id, qty_change, movement_type, ref_table, ref_id, unit_cost, notes, created_by)
                    VALUES (:loc, :part_id, :qty_change, 'GRN', 'goods_receive_notes', :ref_id, :unit_cost, :notes, :created_by)
                ");
                $this->db->bind(':loc', $locId);
                $this->db->bind(':part_id', $partId);
                $this->db->bind(':qty_change', $qty);
                $this->db->bind(':ref_id', $grnId);
                $this->db->bind(':unit_cost', $unitCost);
                $this->db->bind(':notes', $grnNumber);
                $this->db->bind(':created_by', $userId);
                $this->db->execute();

                // If linked to PO, bump received_qty
                if ($poId) {
                    $this->db->query("
                        UPDATE purchase_order_items
                        SET received_qty = received_qty + :qty
                        WHERE purchase_order_id = :po_id AND part_id = :part_id
                    ");
                    $this->db->bind(':qty', $qty);
                    $this->db->bind(':po_id', $poId);
                    $this->db->bind(':part_id', $partId);
                    $this->db->execute();
                }
            }

            // Update PO status if linked
            if ($poId) {
                $po = new PurchaseOrder();
                $po->applyReceipt($poId);
            }

            $this->db->exec("COMMIT");
            return $grnId;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }
}
