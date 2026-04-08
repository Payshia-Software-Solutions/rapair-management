<?php
/**
 * ServiceBay Model
 */

class ServiceBay extends Model {
    private $table = 'service_bays';

    public function getAll() {
        $this->db->query("SELECT * FROM " . $this->table . " ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM " . $this->table . " WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function updateStatus($id, $status, $userId = null) {
        $this->db->query("UPDATE " . $this->table . " SET status = :status, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':status', $status);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function create($name, $userId = null) {
        $this->db->query("INSERT INTO " . $this->table . " (name, created_by, updated_by) VALUES (:name, :created_by, :updated_by)");
        $this->db->bind(':name', $name);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $name, $userId = null) {
        $this->db->query("UPDATE " . $this->table . " SET name = :name, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':name', $name);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM " . $this->table . " WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
