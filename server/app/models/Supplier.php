<?php
/**
 * Supplier Model
 */
class Supplier extends Model {
    private $table = 'suppliers';

    private function ensureSchema() {
        InventorySchema::ensure();
    }

    public function list($q = '') {
        $this->ensureSchema();
        $q = is_string($q) ? trim($q) : '';
        if ($q !== '') {
            $this->db->query("
                SELECT *
                FROM {$this->table}
                WHERE name LIKE :q OR email LIKE :q OR phone LIKE :q
                ORDER BY name ASC
            ");
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            INSERT INTO {$this->table} (name, email, phone, address, is_active, created_by, updated_by)
            VALUES (:name, :email, :phone, :address, :is_active, :created_by, :updated_by)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name,
                email = :email,
                phone = :phone,
                address = :address,
                is_active = :is_active,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->ensureSchema();
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}

