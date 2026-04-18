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
    }

    public function list($locationId) {
        $this->db->query("
            SELECT i.*, c.name as customer_name, rt.name as table_name, u.name as steward_name
            FROM {$this->table} i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
            LEFT JOIN users u ON i.steward_id = u.id
            WHERE i.location_id = :locId AND i.status = 'pending'
            ORDER BY i.created_at DESC
        ");
        $this->db->bind(':locId', $locationId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT i.*, c.name as customer_name, rt.name as table_name, u.name as steward_name
            FROM {$this->table} i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
            LEFT JOIN users u ON i.steward_id = u.id
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
        
        $existing = $this->getItems($heldOrderId);
        $existingMap = [];
        foreach ($existing as $ex) {
            $key = $ex->item_id . '_' . (float)$ex->unit_price;
            $existingMap[$key] = $ex;
        }

        $this->db->query("DELETE FROM {$this->itemTable} WHERE held_order_id = :id");
        $this->db->bind(':id', $heldOrderId);
        $this->db->execute();

        foreach ($items as $item) {
            $key = $item['item_id'] . '_' . (float)$item['unit_price'];
            $kotPrinted = 0;
            
            // If item existed before and qty is same or less, we can assume it's already printed
            if (isset($existingMap[$key])) {
                $ex = $existingMap[$key];
                if ((float)$item['quantity'] <= (float)$ex->quantity) {
                    $kotPrinted = $ex->is_kot_printed;
                }
                // If it's a new item or qty increased, we need a new KOT for the delta
                // But simplified for now: if qty increases, we mark the whole line as unprinted 
                // OR we can store "Quantity Printed" instead of a boolean.
                // Let's stick to boolean for simplicity: if qty > existing_qty, we mark kot_printed = 0
            }

            $this->db->query("
                INSERT INTO {$this->itemTable} (
                    held_order_id, item_id, description, item_type, quantity, unit_price, discount, line_total, is_kot_printed
                ) VALUES (
                    :order_id, :item_id, :desc, :type, :qty, :price, :disc, :total, :kot
                )
            ");
            $this->db->bind(':order_id', $heldOrderId);
            $this->db->bind(':item_id', $item['item_id']);
            $this->db->bind(':desc', $item['description']);
            $this->db->bind(':type', $item['item_type']);
            $this->db->bind(':qty', $item['quantity']);
            $this->db->bind(':price', $item['unit_price']);
            $this->db->bind(':disc', $item['discount'] ?? 0);
            $this->db->bind(':total', $item['line_total']);
            $this->db->bind(':kot', $kotPrinted);
            $this->db->execute();
        }
    }

    public function getUnprintedKOTItems($heldOrderId) {
        $this->db->query("SELECT * FROM {$this->itemTable} WHERE held_order_id = :id AND is_kot_printed = 0");
        $this->db->bind(':id', $heldOrderId);
        return $this->db->resultSet();
    }

    public function markAsPrinted($heldOrderId) {
        $this->db->query("UPDATE {$this->itemTable} SET is_kot_printed = 1 WHERE held_order_id = :id");
        $this->db->bind(':id', $heldOrderId);
        return $this->db->execute();
    }

    public function complete($id) {
        $this->db->query("UPDATE {$this->table} SET status = 'completed' WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
