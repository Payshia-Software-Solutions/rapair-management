<?php
class LogisticsCategory extends Model {
    public function __construct() {
        parent::__construct();
    }

    public function list() {
        $this->db->query("SELECT * FROM logistics_categories ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("INSERT INTO logistics_categories (name, description) VALUES (:name, :description)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':description', $data['description'] ?? '');
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function update($id, $data) {
        $this->db->query("UPDATE logistics_categories SET name = :name, description = :description WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':description', $data['description'] ?? '');
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM logistics_categories WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
