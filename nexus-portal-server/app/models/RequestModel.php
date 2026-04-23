<?php
namespace App\Models;

use App\Core\Database;

class RequestModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function create($data) {
        $this->db->query("INSERT INTO erp_requests (company_name, contact_person, email, phone, expected_users, package_type) VALUES (:company, :contact, :email, :phone, :users, :package)");
        $this->db->bind(':company', $data['company_name']);
        $this->db->bind(':contact', $data['contact_person']);
        $this->db->bind(':email', $data['email']);
        $this->db->bind(':phone', $data['phone']);
        $this->db->bind(':users', $data['expected_users']);
        $this->db->bind(':package', $data['package_type']);
        return $this->db->execute();
    }

    public function getAll() {
        $this->db->query("SELECT * FROM erp_requests ORDER BY created_at DESC");
        return $this->db->resultSet();
    }

    public function updateStatus($id, $status) {
        $this->db->query("UPDATE erp_requests SET status = :status WHERE id = :id");
        $this->db->bind(':status', $status);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
