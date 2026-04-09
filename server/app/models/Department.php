<?php
/**
 * Department Model
 */
class Department extends Model {
    private $table = 'departments';

    // Departments are company-wide; keep location_id in schema for backwards compatibility,
    // but do not filter by it.
    public function getAll() {
        $this->db->query("
            SELECT id, location_id, name, created_at, updated_at
            FROM {$this->table}
            ORDER BY name ASC
        ");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT id, location_id, name, created_at, updated_at
            FROM {$this->table}
            WHERE id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId) {
        // Keep location_id populated for existing schema (use 1 as a neutral company-wide value).
        $this->db->query("
            INSERT INTO {$this->table} (location_id, name, created_by, updated_by)
            VALUES (1, :name, :created_by, :updated_by)
        ");
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId) {
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name, updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}
