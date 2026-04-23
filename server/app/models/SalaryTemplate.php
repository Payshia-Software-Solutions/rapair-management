<?php
/**
 * SalaryTemplate Model
 */
class SalaryTemplate extends Model {
    private $table = 'hr_salary_templates';
    private $itemsTable = 'hr_salary_template_items';

    public function list() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getWithItems($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        $template = $this->db->single();
        
        if ($template) {
            $this->db->query("SELECT * FROM {$this->itemsTable} WHERE template_id = :tid ORDER BY type ASC, name ASC");
            $this->db->bind(':tid', (int)$id);
            $template->items = $this->db->resultSet();
        }
        
        return $template;
    }

    public function create($name) {
        $this->db->query("INSERT INTO {$this->table} (name) VALUES (:name)");
        $this->db->bind(':name', $name);
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function addItem($data) {
        $this->db->query("
            INSERT INTO {$this->itemsTable} (template_id, name, amount, type)
            VALUES (:tid, :name, :amount, :type)
        ");
        $this->db->bind(':tid', (int)$data['template_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':amount', (float)$data['amount']);
        $this->db->bind(':type', $data['type']);
        return $this->db->execute();
    }

    public function removeItem($id) {
        $this->db->query("DELETE FROM {$this->itemsTable} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}
