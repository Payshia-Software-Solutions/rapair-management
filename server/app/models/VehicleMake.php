<?php
/**
 * VehicleMake Model
 */
class VehicleMake extends Model {
    private $table = 'vehicle_makes';

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function create($data, $userId = null) {
        $this->db->query("INSERT INTO {$this->table} (name, created_by, updated_by) VALUES (:name, :created_by, :updated_by)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("UPDATE {$this->table} SET name = :name, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
