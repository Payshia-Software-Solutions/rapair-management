<?php
/**
 * ServiceLocation Model
 */
class ServiceLocation extends Model {
    private $table = 'service_locations';

    public function getAll() {
        $this->db->query("SELECT id, name, address, phone, created_at, updated_at FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT id, name, address, phone, created_at, updated_at FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->db->query("
            INSERT INTO {$this->table} (name, address, phone, created_by, updated_by)
            VALUES (:name, :address, :phone, :created_by, :updated_by)
        ");
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name, address = :address, phone = :phone, updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}

