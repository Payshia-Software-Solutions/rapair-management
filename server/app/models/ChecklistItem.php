<?php
/**
 * ChecklistItem Model
 */

class ChecklistItem extends Model {
    private $table = 'checklist_items';

    public function getByOrderId($orderId) {
        $this->db->query("SELECT * FROM {$this->table} WHERE order_id = :orderId ORDER BY id ASC");
        $this->db->bind(':orderId', $orderId);
        return $this->db->resultSet();
    }

    public function addItem($orderId, $description) {
        $this->db->query("INSERT INTO {$this->table} (order_id, description) VALUES (:orderId, :desc)");
        $this->db->bind(':orderId', $orderId);
        $this->db->bind(':desc', $description);
        return $this->db->execute();
    }
}
