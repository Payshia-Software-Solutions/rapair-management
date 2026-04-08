<?php
/**
 * Department Model
 */
class Department extends Model {
    private $table = 'departments';

    public function getAllByLocation($locationId) {
        $this->db->query("
            SELECT id, location_id, name, created_at, updated_at
            FROM {$this->table}
            WHERE location_id = :location_id
            ORDER BY name ASC
        ");
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->resultSet();
    }

    public function getById($id, $locationId) {
        $this->db->query("
            SELECT id, location_id, name, created_at, updated_at
            FROM {$this->table}
            WHERE id = :id AND location_id = :location_id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->single();
    }

    public function create($data, $userId, $locationId) {
        $this->db->query("
            INSERT INTO {$this->table} (location_id, name, created_by, updated_by)
            VALUES (:location_id, :name, :created_by, :updated_by)
        ");
        $this->db->bind(':location_id', (int)$locationId);
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId, $locationId) {
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name, updated_by = :updated_by
            WHERE id = :id AND location_id = :location_id
        ");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':location_id', (int)$locationId);
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function delete($id, $locationId) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id AND location_id = :location_id");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->execute();
    }
}

