<?php
/**
 * SalaryItem Model
 */
class SalaryItem extends Model {
    private $table = 'hr_salary_items';

    public function listByEmployee($employeeId) {
        $this->db->query("SELECT * FROM {$this->table} WHERE employee_id = :eid ORDER BY type ASC, name ASC");
        $this->db->bind(':eid', (int)$employeeId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (employee_id, name, amount, type, is_recurring)
            VALUES (:eid, :name, :amount, :type, :recurring)
        ");
        $this->db->bind(':eid', (int)$data['employee_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':amount', (float)$data['amount']);
        $this->db->bind(':type', $data['type']);
        $this->db->bind(':recurring', (int)($data['is_recurring'] ?? 1));
        
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}
