<?php
/**
 * Room Model
 */
class Room extends Model {
    private $table = 'hotel_rooms';

    public function getAll($locationId = 1) {
        $this->db->query("
            SELECT r.*, rt.name as type_name, rt.base_rate, rt.max_occupancy
            FROM {$this->table} r
            JOIN hotel_room_types rt ON r.type_id = rt.id
            WHERE r.location_id = :loc
            ORDER BY r.room_number ASC
        ");
        $this->db->bind(':loc', $locationId);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT r.*, rt.name as type_name, rt.base_rate, rt.max_occupancy
            FROM {$this->table} r
            JOIN hotel_room_types rt ON r.type_id = rt.id
            WHERE r.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function updateStatus($id, $status) {
        $this->db->query("UPDATE {$this->table} SET status = :status WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':status', $status);
        return $this->db->execute();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (room_number, type_id, location_id, status, notes)
            VALUES (:no, :type, :loc, :status, :notes)
        ");
        $this->db->bind(':no', $data['room_number']);
        $this->db->bind(':type', $data['type_id']);
        $this->db->bind(':loc', $data['location_id'] ?? 1);
        $this->db->bind(':status', $data['status'] ?? 'Available');
        $this->db->bind(':notes', $data['notes'] ?? null);
        return $this->db->execute();
    }

    public function update($id, $data) {
        $this->db->query("
            UPDATE {$this->table}
            SET room_number = :no, type_id = :type, status = :status, notes = :notes
            WHERE id = :id
        ");
        $this->db->bind(':id', $id);
        $this->db->bind(':no', $data['room_number']);
        $this->db->bind(':type', $data['type_id']);
        $this->db->bind(':status', $data['status'] ?? 'Available');
        $this->db->bind(':notes', $data['notes'] ?? null);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
