<?php
class Bank extends Model {
    public function ensureSchema() {
        require_once __DIR__ . '/../helpers/BankSchema.php';
        BankSchema::ensure();
        return true;
    }

    public function getAll($activeOnly = false) {
        $sql = "SELECT * FROM banks";
        if ($activeOnly) $sql .= " WHERE is_active = 1";
        $sql .= " ORDER BY name ASC";
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM banks WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("INSERT INTO banks (name, code, is_active) VALUES (:name, :code, :active)");
        $this->db->bind(':name',   $data['name']);
        $this->db->bind(':code',   $data['code'] ?? null);
        $this->db->bind(':active', $data['is_active'] ?? 1);
        return $this->db->execute();
    }

    public function update($id, $data) {
        $this->db->query("UPDATE banks SET name = :name, code = :code, is_active = :active WHERE id = :id");
        $this->db->bind(':name',   $data['name']);
        $this->db->bind(':code',   $data['code'] ?? null);
        $this->db->bind(':active', $data['is_active'] ?? 1);
        $this->db->bind(':id',     $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM banks WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
