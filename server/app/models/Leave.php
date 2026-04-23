<?php
/**
 * Leave Model
 */
class Leave extends Model {
    public function __construct() {
        parent::__construct();
        require_once '../app/helpers/HRMSchema.php';
        HRMSchema::ensure();
    }

    public function listTypes() {
        $this->db->query("SELECT * FROM leave_types ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function listRequests($status = null, $employeeId = null) {
        $sql = "
            SELECT lr.*, lt.name AS leave_type_name, e.first_name, e.last_name, e.employee_code, u.name AS approved_intra_name
            FROM leave_requests lr
            INNER JOIN leave_types lt ON lt.id = lr.leave_type_id
            INNER JOIN employees e ON e.id = lr.employee_id
            LEFT JOIN users u ON u.id = lr.approved_by
            WHERE 1=1
        ";
        if ($status) $sql .= " AND lr.status = :status ";
        if ($employeeId) $sql .= " AND lr.employee_id = :eid ";
        $sql .= " ORDER BY lr.created_at DESC ";

        $this->db->query($sql);
        if ($status) $this->db->bind(':status', $status);
        if ($employeeId) $this->db->bind(':eid', $employeeId);
        
        return $this->db->resultSet();
    }

    public function createRequest($data) {
        $this->db->query("
            INSERT INTO leave_requests (employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
            VALUES (:eid, :ltid, :start, :end, :days, :reason, 'Pending')
        ");
        $this->db->bind(':eid', $data['employee_id']);
        $this->db->bind(':ltid', $data['leave_type_id']);
        $this->db->bind(':start', $data['start_date']);
        $this->db->bind(':end', $data['end_date']);
        $this->db->bind(':days', $data['total_days']);
        $this->db->bind(':reason', $data['reason'] ?? null);
        
        return $this->db->execute();
    }

    public function updateStatus($id, $status, $approvedBy) {
        $this->db->query("
            UPDATE leave_requests
            SET status = :status, approved_by = :ab, approved_at = NOW()
            WHERE id = :id
        ");
        $this->db->bind(':status', $status);
        $this->db->bind(':ab', $approvedBy);
        $this->db->bind(':id', (int)$id);
        
        return $this->db->execute();
    }
}
