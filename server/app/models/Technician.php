<?php
/**
 * Technician Model
 */

class Technician extends Model {
    private $table = 'technicians';

    public function getAll() {
        $this->db->query("SELECT * FROM " . $this->table . " ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM " . $this->table . " WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->db->query("INSERT INTO " . $this->table . " (name, role, created_by, updated_by) VALUES (:name, :role, :created_by, :updated_by)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':role', $data['role']);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("UPDATE " . $this->table . " SET name = :name, role = :role, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':role', $data['role']);
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
