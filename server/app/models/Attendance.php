<?php
/**
 * Attendance Model
 */
class Attendance extends Model {
    private $table = 'attendance';

    public function __construct() {
        parent::__construct();
        require_once '../app/helpers/HRMSchema.php';
        HRMSchema::ensure();
    }

    public function log($data) {
        // Find existing record for same emp + date
        $this->db->query("SELECT id FROM {$this->table} WHERE employee_id = :eid AND date = :date LIMIT 1");
        $this->db->bind(':eid', $data['employee_id']);
        $this->db->bind(':date', $data['date']);
        $existing = $this->db->single();

        if ($existing) {
            $sql = "UPDATE {$this->table} SET clock_out = :out, status = :status, notes = :notes WHERE id = :id";
            $this->db->query($sql);
            $this->db->bind(':out', $data['clock_out'] ?? null);
            $this->db->bind(':status', $data['status'] ?? 'Present');
            $this->db->bind(':notes', $data['notes'] ?? null);
            $this->db->bind(':id', $existing->id);
            return $this->db->execute();
        } else {
            $sql = "INSERT INTO {$this->table} (employee_id, date, clock_in, clock_out, status, notes, location_id) 
                    VALUES (:eid, :date, :in, :out, :status, :notes, :loc)";
            $this->db->query($sql);
            $this->db->bind(':eid', $data['employee_id']);
            $this->db->bind(':date', $data['date']);
            $this->db->bind(':in', $data['clock_in'] ?? null);
            $this->db->bind(':out', $data['clock_out'] ?? null);
            $this->db->bind(':status', $data['status'] ?? 'Present');
            $this->db->bind(':notes', $data['notes'] ?? null);
            $this->db->bind(':loc', $data['location_id'] ?? null);
            return $this->db->execute();
        }
    }

    public function list($date = null, $employeeId = null) {
        $sql = "
            SELECT a.*, e.first_name, e.last_name, e.employee_code
            FROM {$this->table} a
            INNER JOIN employees e ON e.id = a.employee_id
            WHERE 1=1
        ";
        if ($date) {
            $sql .= " AND a.date = :date ";
        }
        if ($employeeId) {
            $sql .= " AND a.employee_id = :eid ";
        }
        $sql .= " ORDER BY a.date DESC, e.employee_code ASC ";

        $this->db->query($sql);
        if ($date) $this->db->bind(':date', $date);
        if ($employeeId) $this->db->bind(':eid', $employeeId);
        
        return $this->db->resultSet();
    }
}
