<?php
/**
 * EmployeeDocument Model
 */
class EmployeeDocument extends Model {
    private $table = 'hr_employee_documents';

    public function list($employeeId) {
        $this->db->query("SELECT * FROM {$this->table} WHERE employee_id = :eid ORDER BY created_at DESC");
        $this->db->bind(':eid', (int)$employeeId);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (employee_id, title, file_path, file_name, file_type)
            VALUES (:eid, :title, :path, :name, :type)
        ");
        $this->db->bind(':eid', (int)$data['employee_id']);
        $this->db->bind(':title', $data['title']);
        $this->db->bind(':path', $data['file_path']);
        $this->db->bind(':name', $data['file_name']);
        $this->db->bind(':type', $data['file_type']);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }
}
