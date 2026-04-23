<?php
namespace App\Models;

use App\Core\Database;

class PackageModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function getAll() {
        $this->db->query("SELECT * FROM saas_packages");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM saas_packages WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $modules = json_encode($data['modules'] ?? ['*']);
        $services = json_encode($data['services'] ?? []);
        $is_public = $data['is_public'] ?? 1;
        $this->db->query("INSERT INTO saas_packages (name, package_key, monthly_price, modules, services, server_info, is_public) VALUES (:name, :key, :price, :modules, :services, :server, :is_public)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':key', $data['package_key']);
        $this->db->bind(':price', $data['monthly_price']);
        $this->db->bind(':modules', $modules);
        $this->db->bind(':services', $services);
        $this->db->bind(':server', $data['server_info'] ?? '');
        $this->db->bind(':is_public', $is_public);
        return $this->db->execute();
    }

    public function update($data) {
        $modules = json_encode($data['modules'] ?? ['*']);
        $services = json_encode($data['services'] ?? []);
        $is_public = $data['is_public'] ?? 1;
        $this->db->query("UPDATE saas_packages SET name = :name, monthly_price = :price, modules = :modules, services = :services, server_info = :server, is_public = :is_public WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':price', $data['monthly_price']);
        $this->db->bind(':modules', $modules);
        $this->db->bind(':services', $services);
        $this->db->bind(':server', $data['server_info'] ?? '');
        $this->db->bind(':is_public', $is_public);
        $this->db->bind(':id', $data['id']);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM saas_packages WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
