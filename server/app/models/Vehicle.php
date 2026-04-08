<?php
/**
 * Vehicle Model
 */
class Vehicle extends Model {
    private $table = 'vehicles';

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY id ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->db->query("INSERT INTO {$this->table} (make, model, year, vin, created_by, updated_by) VALUES (:make, :model, :year, :vin, :created_by, :updated_by)");
        $this->db->bind(':make', $data['make']);
        $this->db->bind(':model', $data['model']);
        $this->db->bind(':year', $data['year']);
        $this->db->bind(':vin', $data['vin']);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("UPDATE {$this->table} SET make = :make, model = :model, year = :year, vin = :vin, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':make', $data['make']);
        $this->db->bind(':model', $data['model']);
        $this->db->bind(':year', $data['year']);
        $this->db->bind(':vin', $data['vin']);
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
