<?php
/**
 * HRCategory Model
 */
class HRCategory extends Model {
    private $table = 'hr_categories';

    public function list() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("INSERT INTO {$this->table} (name, prefix) VALUES (:name, :prefix)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':prefix', strtoupper($data['prefix']));
        return $this->db->execute();
    }
}
