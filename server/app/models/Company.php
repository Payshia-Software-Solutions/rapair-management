<?php
/**
 * Company Model (singleton row id=1)
 */
class Company extends Model {
    private $table = 'company';

    public function get() {
        $this->db->query("SELECT id, name, address, phone, email, tax_no, tax_label, tax_ids_json, logo_filename, created_at, updated_at FROM {$this->table} WHERE id = 1 LIMIT 1");
        return $this->db->single();
    }

    public function update($data, $userId = null) {
        // Keep it simple: upsert row 1
        $existing = $this->get();
        if (!$existing) {
            $this->db->query("
                INSERT INTO {$this->table} (id, name, address, phone, email, tax_no, tax_label, tax_ids_json, logo_filename)
                VALUES (1, :name, :address, :phone, :email, :tax_no, :tax_label, :tax_ids_json, :logo_filename)
            ");
            $this->db->bind(':name', trim((string)($data['name'] ?? 'ServiceBay')));
            $this->db->bind(':address', $data['address'] ?? null);
            $this->db->bind(':phone', $data['phone'] ?? null);
            $this->db->bind(':email', $data['email'] ?? null);
            $this->db->bind(':tax_no', $data['tax_no'] ?? null);
            $this->db->bind(':tax_label', $data['tax_label'] ?? null);
            $this->db->bind(':tax_ids_json', $data['tax_ids_json'] ?? null);
            $this->db->bind(':logo_filename', $data['logo_filename'] ?? null);
            return $this->db->execute();
        }

        $this->db->query("
            UPDATE {$this->table}
            SET name = :name,
                address = :address,
                phone = :phone,
                email = :email,
                tax_no = :tax_no,
                tax_label = :tax_label,
                tax_ids_json = :tax_ids_json,
                logo_filename = :logo_filename
            WHERE id = 1
        ");
        $this->db->bind(':name', trim((string)($data['name'] ?? $existing->name)));
        $this->db->bind(':address', $data['address'] ?? $existing->address);
        $this->db->bind(':phone', $data['phone'] ?? $existing->phone);
        $this->db->bind(':email', $data['email'] ?? $existing->email);
        $this->db->bind(':tax_no', $data['tax_no'] ?? $existing->tax_no);
        $this->db->bind(':tax_label', $data['tax_label'] ?? $existing->tax_label);
        $this->db->bind(':tax_ids_json', $data['tax_ids_json'] ?? $existing->tax_ids_json);
        $this->db->bind(':logo_filename', $data['logo_filename'] ?? $existing->logo_filename);
        return $this->db->execute();
    }

    public function getTaxes($companyId = 1) {
        $comp = $this->get();
        if (!$comp || empty($comp->tax_ids_json)) return [];
        
        $ids = json_decode($comp->tax_ids_json, true);
        if (empty($ids) || !is_array($ids)) return [];

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $this->db->query("SELECT * FROM taxes WHERE id IN ($placeholders) AND is_active = 1");
        
        foreach ($ids as $index => $id) {
            $this->db->bind($index + 1, (int)$id);
        }
        
        return $this->db->resultSet();
    }
}

