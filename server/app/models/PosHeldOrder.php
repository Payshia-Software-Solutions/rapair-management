<?php
/**
 * PosHeldOrder Model
 */
class PosHeldOrder extends Model {
    private $table = 'pos_held_orders';
    private $itemTable = 'pos_held_order_items';

    public function __construct() {
        parent::__construct();
        require_once '../app/helpers/PosHeldOrderSchema.php';
        PosHeldOrderSchema::ensure();
        require_once '../app/helpers/CompSchema.php';
        CompSchema::ensure();
    }

    public function list($locationId) {
        $this->db->query("
            SELECT i.*, c.name as customer_name, rt.name as table_name, u.name as steward_name, sl.name as location_name
            FROM {$this->table} i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
            LEFT JOIN users u ON i.steward_id = u.id
            LEFT JOIN service_locations sl ON i.location_id = sl.id
            WHERE i.location_id = :locId AND i.status = 'pending'
            ORDER BY i.created_at DESC
        ");
        $this->db->bind(':locId', $locationId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT i.*, c.name as customer_name, rt.name as table_name, u.name as steward_name, sl.name as location_name
            FROM {$this->table} i
            LEFT JOIN customers c ON i.customer_id = c.id
            LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
            LEFT JOIN users u ON i.steward_id = u.id
            LEFT JOIN service_locations sl ON i.location_id = sl.id
            WHERE i.id = :id
        ");
        $this->db->bind(':id', $id);
        $order = $this->db->single();
        if ($order) {
            $order->items = $this->getItems($id);
        }
        return $order;
    }

    public function getItems($heldOrderId) {
        $this->db->query("SELECT * FROM {$this->itemTable} WHERE held_order_id = :id");
        $this->db->bind(':id', $heldOrderId);
        return $this->db->resultSet();
    }

    public function save($data, $userId = null) {
        $id = $data['id'] ?? $data['held_order_id'] ?? null;
        if ($id) {
            // Update existing
            $this->db->query("
                UPDATE {$this->table} SET 
                    customer_id = :customer_id, table_id = :table_id, steward_id = :steward_id,
                    subtotal = :subtotal, tax_total = :tax_total, discount_total = :discount_total,
                    grand_total = :grand_total, notes = :notes, updated_by = :userId
                WHERE id = :id
            ");
            $this->db->bind(':id', $id);
        } else {
            // Create new
            $this->db->query("
                INSERT INTO {$this->table} (
                    location_id, customer_id, order_type, table_id, steward_id, 
                    subtotal, tax_total, discount_total, grand_total, notes, created_by, updated_by
                ) VALUES (
                    :location_id, :customer_id, :order_type, :table_id, :steward_id,
                    :subtotal, :tax_total, :discount_total, :grand_total, :notes, :userId, :userId
                )
            ");
            $this->db->bind(':location_id', $data['location_id']);
            $this->db->bind(':order_type', $data['order_type']);
        }

        $this->db->bind(':customer_id', $data['customer_id']);
        $this->db->bind(':table_id', $data['table_id'] ?? null);
        $this->db->bind(':steward_id', $data['steward_id'] ?? null);
        $this->db->bind(':subtotal', $data['subtotal']);
        $this->db->bind(':tax_total', $data['tax_total']);
        $this->db->bind(':discount_total', $data['discount_total']);
        $this->db->bind(':grand_total', $data['grand_total']);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':userId', $userId);

        if (!$this->db->execute()) return false;
        if (!$id) $id = $this->db->lastInsertId();

        // Sync items
        if (isset($data['items'])) {
            $this->syncItems($id, $data['items']);
        }

        return $id;
    }

    private function syncItems($heldOrderId, $items) {
        // Simple approach for "Hold": delete all existing and re-insert,
        // BUT we must preserve the 'is_kot_printed' flag for items that haven't changed.
        
        // Qty the kitchen already has, pooled per item/price/notes. A line can be split in two
        // (e.g. 1 of 3 made complimentary), so lines sharing a key draw from the same pool and the
        // kitchen doesn't get the split-off part again.
        $existing = $this->getItems($heldOrderId);
        $printedPool = [];
        foreach ($existing as $ex) {
            $key = $ex->item_id . '_' . (float)$ex->unit_price . '_' . md5((string)($ex->item_notes ?? '') . '|' . (string)($ex->modifiers_json ?? ''));
            $exPrinted = isset($ex->kot_printed_qty) ? (float)$ex->kot_printed_qty : 0.0;
            if ($exPrinted <= 0 && (int)$ex->is_kot_printed === 1) $exPrinted = (float)$ex->quantity; // legacy rows
            $printedPool[$key] = ($printedPool[$key] ?? 0.0) + $exPrinted;
        }

        $this->db->query("DELETE FROM {$this->itemTable} WHERE held_order_id = :id");
        $this->db->bind(':id', $heldOrderId);
        $this->db->execute();

        foreach ($items as $item) {
            $notes = trim((string)($item['item_notes'] ?? ''));
            $notes = $notes !== '' ? mb_substr($notes, 0, 500) : null;
            $mods = $item['modifiers'] ?? null;
            $modsJson = (is_array($mods) && !empty($mods)) ? json_encode($mods) : null;
            $key = $item['item_id'] . '_' . (float)$item['unit_price'] . '_' . md5((string)($notes ?? '') . '|' . (string)($modsJson ?? ''));
            // Track HOW MANY of this line the kitchen already has, so a qty increase
            // prints only the extra (e.g. 1 sent, now 3 -> next KOT shows 2x).
            $printedQty = 0.0;
            if (!empty($printedPool[$key])) {
                $printedQty = min((float)$item['quantity'], $printedPool[$key]);
                $printedPool[$key] -= $printedQty;
            }
            $kotPrinted = ($printedQty >= (float)$item['quantity'] && (float)$item['quantity'] > 0) ? 1 : 0;

            // Comp is only a request here; the approval token is checked when the bill is settled
            $isComp = !empty($item['is_complimentary']) && preg_match('/^[a-f0-9]{40}$/', (string)($item['comp_token'] ?? ''));

            $this->db->query("
                INSERT INTO {$this->itemTable} (
                    held_order_id, item_id, description, item_type, quantity, unit_price, discount, line_total, is_kot_printed, kot_printed_qty, item_notes, modifiers_json,
                    is_complimentary, comp_reason, comp_token
                ) VALUES (
                    :order_id, :item_id, :desc, :type, :qty, :price, :disc, :total, :kot, :kotqty, :notes, :mods,
                    :is_comp, :comp_reason, :comp_token
                )
            ");
            $this->db->bind(':is_comp', $isComp ? 1 : 0);
            $this->db->bind(':comp_reason', $isComp ? mb_substr((string)($item['comp_reason'] ?? ''), 0, 255) : null);
            $this->db->bind(':comp_token', $isComp ? $item['comp_token'] : null);
            $this->db->bind(':order_id', $heldOrderId);
            $this->db->bind(':item_id', $item['item_id']);
            $this->db->bind(':desc', $item['description']);
            $this->db->bind(':type', $item['item_type']);
            $this->db->bind(':qty', $item['quantity']);
            $this->db->bind(':price', $item['unit_price']);
            $this->db->bind(':disc', $item['discount'] ?? 0);
            $this->db->bind(':total', $item['line_total']);
            $this->db->bind(':kot', $kotPrinted);
            $this->db->bind(':kotqty', $printedQty);
            $this->db->bind(':notes', $notes);
            $this->db->bind(':mods', $modsJson);
            $this->db->execute();
        }
    }

    public function getUnprintedKOTItems($heldOrderId) {
        // Only what the kitchen hasn't seen yet: new lines in full, increased lines by the difference
        $this->db->query("SELECT * FROM {$this->itemTable} WHERE held_order_id = :id AND quantity > kot_printed_qty");
        $this->db->bind(':id', $heldOrderId);
        $rows = $this->db->resultSet() ?: [];
        foreach ($rows as $r) {
            $delta = (float)$r->quantity - (float)$r->kot_printed_qty;
            $r->line_quantity = $r->quantity;
            $r->quantity = rtrim(rtrim(number_format($delta, 3, '.', ''), '0'), '.');
        }
        return $rows;
    }

    public function markAsPrinted($heldOrderId) {
        $this->db->query("UPDATE {$this->itemTable} SET is_kot_printed = 1, kot_printed_qty = quantity WHERE held_order_id = :id");
        $this->db->bind(':id', $heldOrderId);
        $ok = $this->db->execute();
        // Cancelled items have now been announced to the kitchen too
        try {
            $this->db->query("UPDATE pos_held_order_voids SET is_kot_printed = 1 WHERE held_order_id = :id");
            $this->db->bind(':id', $heldOrderId);
            $this->db->execute();
        } catch (Exception $e) { /* table may not exist on older installs */ }
        return $ok;
    }

    /** Items removed after the KOT, with who removed and who approved. */
    public function getVoids($heldOrderId, $unprintedOnly = true) {
        try {
            $this->db->query("
                SELECT v.*, rb.name AS removed_by_name, ab.name AS approved_by_name
                FROM pos_held_order_voids v
                LEFT JOIN users rb ON rb.id = v.removed_by
                LEFT JOIN users ab ON ab.id = v.approved_by
                WHERE v.held_order_id = :id" . ($unprintedOnly ? " AND v.is_kot_printed = 0" : "") . "
                ORDER BY v.id ASC
            ");
            $this->db->bind(':id', $heldOrderId);
            return $this->db->resultSet();
        } catch (Exception $e) {
            return [];
        }
    }

    public function complete($id) {
        $this->db->query("UPDATE {$this->table} SET status = 'completed' WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
