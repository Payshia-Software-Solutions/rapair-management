<?php
/**
 * User Model
 */
class User extends Model {
    private $table = 'users';

    public function getByEmail($email) {
        $this->db->query("
            SELECT u.*, r.name AS role
            FROM {$this->table} u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.email = :email
            LIMIT 1
        ");
        $this->db->bind(':email', $email);
        return $this->db->single();
    }

    public function getById($id) {
        $this->db->query("
            SELECT u.id, u.name, u.email, r.name AS role, u.created_at
            FROM {$this->table} u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("INSERT INTO {$this->table} (name, email, password_hash, role_id) VALUES (:name, :email, :password_hash, :role_id)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email']);
        $this->db->bind(':password_hash', $data['password_hash']);
        $this->db->bind(':role_id', $data['role_id']);
        return $this->db->execute();
    }
}
