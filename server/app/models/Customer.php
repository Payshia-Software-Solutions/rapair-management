<?php
/**
 * Customer Model
 */

class Customer extends Model {
    private $table = 'customers';

    public function getAll() {
        $this->db->query("
            SELECT c.*, 
                   (SELECT COALESCE(SUM(i.grand_total - i.paid_amount), 0) 
                    FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status != 'Cancelled') as total_outstanding
            FROM {$this->table} c 
            ORDER BY c.name ASC
        ");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT c.*, 
                   (SELECT COALESCE(SUM(i.grand_total - i.paid_amount), 0) 
                    FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status != 'Cancelled') as total_outstanding
            FROM {$this->table} c 
            WHERE c.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->db->query("
            INSERT INTO {$this->table} 
            (name, phone, email, address, nic, tax_number, order_type, is_active, credit_limit, credit_days, created_by, updated_by) 
            VALUES 
            (:name, :phone, :email, :address, :nic, :tax_number, :order_type, :is_active, :credit_limit, :credit_days, :created_by, :updated_by)
        ");
        
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':tax_number', $data['tax_number'] ?? null);
        $this->db->bind(':order_type', $data['order_type'] ?? 'External');
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
        $this->db->bind(':credit_limit', $data['credit_limit'] ?? 0);
        $this->db->bind(':credit_days', $data['credit_days'] ?? 0);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);

        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("
            UPDATE {$this->table} 
            SET name = :name, 
                phone = :phone, 
                email = :email, 
                address = :address, 
                nic = :nic, 
                tax_number = :tax_number, 
                order_type = :order_type, 
                is_active = :is_active, 
                credit_limit = :credit_limit,
                credit_days = :credit_days,
                updated_by = :updated_by 
            WHERE id = :id
        ");
        
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':tax_number', $data['tax_number'] ?? null);
        $this->db->bind(':order_type', $data['order_type'] ?? 'External');
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
        $this->db->bind(':credit_limit', $data['credit_limit'] ?? 0);
        $this->db->bind(':credit_days', $data['credit_days'] ?? 0);
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
