<?php
/**
 * ChecklistTemplate Model (Global checklist repository)
 */
class ChecklistTemplate extends Model {
    private $table = 'checklist_templates';

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY id DESC");
        return $this->db->resultSet();
    }

    public function create($description, $userId = null) {
        $this->db->query("INSERT INTO {$this->table} (description, created_by, updated_by) VALUES (:description, :created_by, :updated_by)");
        $this->db->bind(':description', $description);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $description, $userId = null) {
        $this->db->query("UPDATE {$this->table} SET description = :description, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':description', $description);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
