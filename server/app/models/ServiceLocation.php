<?php
/**
 * ServiceLocation Model
 */
class ServiceLocation extends Model {
    private $table = 'service_locations';

    private function ensureSchema() {
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'location_type'");
            $exists = (bool)$this->db->single();
            if (!$exists) {
                $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN location_type ENUM('service','warehouse') NOT NULL DEFAULT 'service' AFTER name");
            }
        } catch (Exception $e) {
            // ignore best-effort
        }
    }

    public function getAll() {
        $this->ensureSchema();
        $this->db->query("SELECT id, name, location_type, address, phone, tax_no, tax_label, created_at, updated_at FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("SELECT id, name, location_type, address, phone, tax_no, tax_label, created_at, updated_at FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            INSERT INTO {$this->table} (name, location_type, address, phone, tax_no, tax_label, created_by, updated_by)
            VALUES (:name, :location_type, :address, :phone, :tax_no, :tax_label, :created_by, :updated_by)
        ");
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':location_type', $data['location_type'] ?? 'service');
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':tax_no', $data['tax_no'] ?? null);
        $this->db->bind(':tax_label', $data['tax_label'] ?? null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name, location_type = :location_type, address = :address, phone = :phone, 
                tax_no = :tax_no, tax_label = :tax_label, updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':name', trim((string)($data['name'] ?? '')));
        $this->db->bind(':location_type', $data['location_type'] ?? 'service');
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':tax_no', $data['tax_no'] ?? null);
        $this->db->bind(':tax_label', $data['tax_label'] ?? null);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }
}
