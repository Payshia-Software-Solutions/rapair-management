<?php
/**
 * AttendanceController
 */
class AttendanceController extends Controller {
    private $attendanceModel;

    public function __construct() {
        $this->attendanceModel = $this->model('Attendance');
    }

    public function index() {
        $this->list();
    }

    public function list() {
        $this->requirePermission('hrm.read');
        $date = $_GET['date'] ?? null;
        $eid = $_GET['employee_id'] ?? null;
        $rows = $this->attendanceModel->list($date, $eid);
        $this->success($rows);
    }

    public function log() {
        $u = $this->requirePermission('attendance.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        
        if (!isset($data['employee_id']) || !isset($data['date'])) {
            $this->error('Employee ID and Date required');
        }

        if ($this->attendanceModel->log($data)) {
            $this->success(null, 'Attendance recorded');
        }
        $this->error('Failed to record attendance');
    }
}
