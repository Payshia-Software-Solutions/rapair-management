<?php
/**
 * Company Model (singleton row id=1)
 */
class Company extends Model {
    private $table = 'company';

    public function get() {
        $this->db->query("SELECT id, name, address, phone, email, logo_filename, created_at, updated_at FROM {$this->table} WHERE id = 1 LIMIT 1");
        return $this->db->single();
    }

    public function update($data, $userId = null) {
        // Keep it simple: upsert row 1
        $existing = $this->get();
        if (!$existing) {
            $this->db->query("
                INSERT INTO {$this->table} (id, name, address, phone, email, logo_filename)
                VALUES (1, :name, :address, :phone, :email, :logo_filename)
            ");
            $this->db->bind(':name', trim((string)($data['name'] ?? 'ServiceBay')));
            $this->db->bind(':address', $data['address'] ?? null);
            $this->db->bind(':phone', $data['phone'] ?? null);
            $this->db->bind(':email', $data['email'] ?? null);
            $this->db->bind(':logo_filename', $data['logo_filename'] ?? null);
            return $this->db->execute();
        }

        $this->db->query("
            UPDATE {$this->table}
            SET name = :name,
                address = :address,
                phone = :phone,
                email = :email,
                logo_filename = :logo_filename
            WHERE id = 1
        ");
        $this->db->bind(':name', trim((string)($data['name'] ?? $existing->name)));
        $this->db->bind(':address', $data['address'] ?? $existing->address);
        $this->db->bind(':phone', $data['phone'] ?? $existing->phone);
        $this->db->bind(':email', $data['email'] ?? $existing->email);
        $this->db->bind(':logo_filename', $data['logo_filename'] ?? $existing->logo_filename);
        return $this->db->execute();
    }
}

