<?php
namespace App\Models;

use App\Core\Database;

class AdminModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function findByUsername($username) {
        $this->db->query("SELECT * FROM portal_admins WHERE username = :user");
        $this->db->bind(':user', $username);
        return $this->db->single();
    }

    public function getAll() {
        $this->db->query("
            SELECT a.id, a.username, a.full_name, a.email_verified, a.role, a.created_at, t.name as tenant_name 
            FROM portal_admins a
            LEFT JOIN saas_tenants t ON a.tenant_id = t.id
            ORDER BY a.created_at DESC
        ");
        return $this->db->resultSet();
    }

    public function findByToken($token) {
        $this->db->query("SELECT * FROM portal_admins WHERE verification_token = :token");
        $this->db->bind(':token', $token);
        return $this->db->single();
    }

    public function verifyByToken($token) {
        $this->db->query("UPDATE portal_admins SET email_verified = 1, verification_token = NULL WHERE verification_token = :token");
        $this->db->bind(':token', $token);
        return $this->db->execute();
    }

    public function create($data) {
        $role = $data['role'] ?? 'client';
        $name = $data['full_name'] ?? $data['username'];
        $this->db->query("INSERT INTO portal_admins (tenant_id, username, password, full_name, verification_token, email_verified, role) VALUES (:tid, :user, :pass, :name, :token, 0, :role)");
        $this->db->bind(':tid', $data['tenant_id'] ?? null);
        $this->db->bind(':user', $data['username']);
        $this->db->bind(':pass', password_hash($data['password'], PASSWORD_BCRYPT));
        $this->db->bind(':name', $name);
        $this->db->bind(':token', $data['verification_token'] ?? null);
        $this->db->bind(':role', $role);
        return $this->db->execute();
    }
}
