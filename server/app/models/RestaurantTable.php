<?php
/**
 * RestaurantTable Model
 */
class RestaurantTable extends Model {
    private $table = 'restaurant_tables';

    public function list($locationId) {
        $this->db->query("
            SELECT rt.*, sl.name as location_name 
            FROM {$this->table} rt
            LEFT JOIN service_locations sl ON sl.id = rt.location_id
            WHERE rt.location_id = :location_id 
            ORDER BY rt.name ASC
        ");
        $this->db->bind(':location_id', $locationId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("INSERT INTO {$this->table} (name, location_id, status) VALUES (:name, :location_id, :status)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':location_id', $data['location_id']);
        $this->db->bind(':status', $data['status'] ?? 'Available');
        return $this->db->execute();
    }

    public function update($id, $data) {
        $this->db->query("UPDATE {$this->table} SET name = :name, location_id = :location_id, status = :status WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':location_id', $data['location_id']);
        $this->db->bind(':status', $data['status'] ?? 'Available');
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
