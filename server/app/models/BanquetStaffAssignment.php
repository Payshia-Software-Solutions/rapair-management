<?php

class BanquetStaffAssignment extends Model {
    protected $table = 'banquet_staff_assignments';

    public function getByBooking($bookingId) {
        $this->db->query("
            SELECT bsa.*, e.name as employee_name, e.employee_id as employee_code
            FROM {$this->table} bsa
            JOIN employees e ON bsa.employee_id = e.id
            WHERE bsa.booking_id = :booking_id
            ORDER BY bsa.created_at DESC
        ");
        $this->db->bind(':booking_id', $bookingId);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (booking_id, employee_id, role, notes)
            VALUES (:booking_id, :employee_id, :role, :notes)
        ");
        $this->db->bind(':booking_id', $data['booking_id']);
        $this->db->bind(':employee_id', $data['employee_id']);
        $this->db->bind(':role', $data['role'] ?? null);
        $this->db->bind(':notes', $data['notes'] ?? null);
        
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
