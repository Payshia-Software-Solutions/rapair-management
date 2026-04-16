<?php
/**
 * Vehicle Model
 */
class Vehicle extends Model {
    private $table = 'vehicles';

    private function ensureDepartmentColumn() {
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'department_id'");
            $hasDept = (bool)$this->db->single();
            if (!$hasDept) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN department_id INT NULL");
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    private function ensureImageColumn() {
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'image_filename'");
            $exists = (bool)$this->db->single();
            if (!$exists) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN image_filename VARCHAR(255) NULL");
            }
        } catch (Exception $e) {
            // ignore
        }
    }

    public function getAll($filter = 'all') {
        $sql = "
            SELECT v.*, c.name as customer_name, d.name as department_name 
            FROM {$this->table} v
            LEFT JOIN customers c ON v.customer_id = c.id
            LEFT JOIN departments d ON v.department_id = d.id
        ";
        if ($filter === 'internal') {
            $sql .= " WHERE v.customer_id IS NULL";
        } elseif ($filter === 'customer') {
            $sql .= " WHERE v.customer_id IS NOT NULL";
        }
        $sql .= " ORDER BY v.id ASC";
        
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT v.*, c.name as customer_name, d.name as department_name 
            FROM {$this->table} v
            LEFT JOIN customers c ON v.customer_id = c.id
            LEFT JOIN departments d ON v.department_id = d.id
            WHERE v.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->ensureImageColumn();
        $this->ensureDepartmentColumn();
        $this->db->query("
            INSERT INTO {$this->table} (customer_id, department_id, make, model, year, vin, image_filename, created_by, updated_by)
            VALUES (:customer_id, :department_id, :make, :model, :year, :vin, :image_filename, :created_by, :updated_by)
        ");
        $this->db->bind(':customer_id', $data['customer_id'] ?? null);
        $this->db->bind(':department_id', $data['department_id'] ?? null);
        $this->db->bind(':make', $data['make']);
        $this->db->bind(':model', $data['model']);
        $this->db->bind(':year', $data['year']);
        $this->db->bind(':vin', $data['vin']);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->ensureImageColumn();
        $this->ensureDepartmentColumn();
        $this->db->query("
            UPDATE {$this->table}
            SET customer_id = :customer_id,
                department_id = :department_id,
                make = :make,
                model = :model,
                year = :year,
                vin = :vin,
                image_filename = :image_filename,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':customer_id', $data['customer_id'] ?? null);
        $this->db->bind(':department_id', $data['department_id'] ?? null);
        $this->db->bind(':make', $data['make']);
        $this->db->bind(':model', $data['model']);
        $this->db->bind(':year', $data['year']);
        $this->db->bind(':vin', $data['vin']);
        $this->db->bind(':image_filename', $data['image_filename'] ?? null);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getByCustomer($customerId) {
        $this->db->query("
            SELECT v.*, c.name as customer_name, d.name as department_name 
            FROM {$this->table} v
            LEFT JOIN customers c ON v.customer_id = c.id
            LEFT JOIN departments d ON v.department_id = d.id
            WHERE v.customer_id = :customer_id 
            ORDER BY v.id ASC
        ");
        $this->db->bind(':customer_id', $customerId);
        return $this->db->resultSet();
    }
}
