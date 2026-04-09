<?php
/**
 * User Model
 */
class User extends Model {
    private $table = 'users';

    private function ensureIsActiveColumn() {
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'is_active'");
            $exists = (bool)$this->db->single();
            if (!$exists) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    public function getByEmail($email) {
        $this->ensureIsActiveColumn();
        $this->db->query("
            SELECT u.*, r.name AS role, sl.name AS location_name
            FROM {$this->table} u
            INNER JOIN roles r ON r.id = u.role_id
            INNER JOIN service_locations sl ON sl.id = u.location_id
            WHERE u.email = :email
            LIMIT 1
        ");
        $this->db->bind(':email', $email);
        return $this->db->single();
    }

    public function getById($id) {
        $this->ensureIsActiveColumn();
        $this->db->query("
            SELECT u.id, u.name, u.email, u.role_id, r.name AS role, u.location_id, sl.name AS location_name, u.is_active, u.created_at
            FROM {$this->table} u
            INNER JOIN roles r ON r.id = u.role_id
            INNER JOIN service_locations sl ON sl.id = u.location_id
            WHERE u.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->ensureIsActiveColumn();
        $this->db->query("INSERT INTO {$this->table} (name, email, password_hash, role_id, location_id, is_active) VALUES (:name, :email, :password_hash, :role_id, :location_id, :is_active)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email']);
        $this->db->bind(':password_hash', $data['password_hash']);
        $this->db->bind(':role_id', $data['role_id']);
        $this->db->bind(':location_id', $data['location_id'] ?? 1);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
        return $this->db->execute();
    }
}
