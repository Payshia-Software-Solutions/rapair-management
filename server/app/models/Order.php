<?php
/**
 * Order Model
 */

class Order extends Model {
    private $table = 'repair_orders';

    // Get all orders
    public function getOrders() {
        $this->db->query("SELECT * FROM " . $this->table . " ORDER BY created_at DESC");
        return $this->db->resultSet();
    }

    // Get order by ID
    public function getOrderById($id) {
        $this->db->query("SELECT * FROM " . $this->table . " WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    // Add Order
    public function addOrder($data, $userId = null) {
        $this->db->query("INSERT INTO " . $this->table . " (customer_name, vehicle_model, problem_description, status, created_by, updated_by) VALUES (:customer_name, :vehicle_model, :problem_description, :status, :created_by, :updated_by)");
        
        // Bind values
        $this->db->bind(':customer_name', $data['customer_name']);
        $this->db->bind(':vehicle_model', $data['vehicle_model']);
        $this->db->bind(':problem_description', $data['problem_description']);
        $this->db->bind(':status', $data['status'] ?? 'Pending');
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);

        return $this->db->execute();
    }

    // Update Status
    public function updateStatus($id, $status, $userId = null) {
        $this->db->query("UPDATE " . $this->table . " SET status = :status, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':status', $status);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
