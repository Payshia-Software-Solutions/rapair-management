<?php
/**
 * Payroll Model
 */
class Payroll extends Model {
    public function __construct() {
        parent::__construct();
        require_once '../app/helpers/HRMSchema.php';
        HRMSchema::ensure();
    }

    public function list($month = null, $year = null) {
        $sql = "
            SELECT p.*, e.first_name, e.last_name, e.employee_code, e.bank_account_no, e.bank_name
            FROM payroll p
            INNER JOIN employees e ON e.id = p.employee_id
            WHERE 1=1
        ";
        if ($month) $sql .= " AND p.month = :m ";
        if ($year) $sql .= " AND p.year = :y ";
        $sql .= " ORDER BY p.year DESC, p.month DESC, e.employee_code ASC ";

        $this->db->query($sql);
        if ($month) $this->db->bind(':m', $month);
        if ($year) $this->db->bind(':y', $year);
        
        return $this->db->resultSet();
    }

    public function generate($employeeId, $month, $year, $userId = null) {
        // 1. Get Employee Basic info
        require_once '../app/models/Employee.php';
        $empModel = new Employee();
        $emp = $empModel->getById($employeeId);
        if (!$emp) return false;

        $basic = (float)$emp['basic_salary'];
        
        // 2. Fetch Recurring Salary Items (Template)
        require_once '../app/models/SalaryItem.php';
        $itemModel = new SalaryItem();
        $items = $itemModel->listByEmployee($employeeId);
        
        $allowances = 0.00;
        $deductions = 0.00;
        $breakdownItems = [
            ['name' => 'Basic Salary', 'amount' => $basic, 'type' => 'Allowance']
        ];
        
        foreach ($items as $item) {
            if ($item['is_recurring']) {
                $amount = (float)$item['amount'];
                if ($item['type'] === 'Allowance') {
                    $allowances += $amount;
                } else {
                    $deductions += $amount;
                }
                $breakdownItems[] = [
                    'name' => $item['name'],
                    'amount' => $amount,
                    'type' => $item['type']
                ];
            }
        }

        // 2.1 Automated Attendance Deductions
        require_once '../app/models/HRSetting.php';
        $hrSettings = new HRSetting();
        $settings = $hrSettings->getAll();

        if (($settings['PAYROLL_AUTO_CALC_ATTENDANCE'] ?? '0') === '1') {
            require_once '../app/models/Attendance.php';
            $attModel = new Attendance();
            $attendance = $attModel->list(null, $employeeId);
            
            $lateCount = 0;
            $absentCount = 0;
            $halfDayCount = 0;

            foreach ($attendance as $att) {
                $attDate = new DateTime($att->date);
                if ((int)$attDate->format('m') === (int)$month && (int)$attDate->format('Y') === (int)$year) {
                    if ($att->status === 'Late') $lateCount++;
                    if ($att->status === 'Absent') $absentCount++;
                    if ($att->status === 'Half-Day') $halfDayCount++;
                }
            }

            // Lateness Penalty
            $latePenaltyRate = (float)($settings['PAYROLL_LATE_PENALTY'] ?? 0);
            if ($lateCount > 0 && $latePenaltyRate > 0) {
                $val = $lateCount * $latePenaltyRate;
                $deductions += $val;
                $breakdownItems[] = [
                    'name' => "Lateness Penalty ({$lateCount} occurrences)",
                    'amount' => $val,
                    'type' => 'Deduction',
                    'auto' => true
                ];
            }

            // Absence Deduction
            $absentVal = 0;
            $totalAbsentDays = $absentCount + ($halfDayCount * 0.5);
            if ($totalAbsentDays > 0) {
                if (($settings['PAYROLL_ABSENCE_DEDUCTION_TYPE'] ?? 'daily_fraction') === 'daily_fraction') {
                    $dailyWage = $basic / 30;
                    $absentVal = $totalAbsentDays * $dailyWage;
                } else {
                    $fixed = (float)($settings['PAYROLL_ABSENCE_FIXED_AMOUNT'] ?? 0);
                    $absentVal = $totalAbsentDays * $fixed;
                }
            }

            if ($absentVal > 0) {
                $deductions += $absentVal;
                $breakdownItems[] = [
                    'name' => "Absence Deduction ({$totalAbsentDays} days)",
                    'amount' => $absentVal,
                    'type' => 'Deduction',
                    'auto' => true
                ];
            }
        }
        
        $net = $basic + $allowances - $deductions;
        $breakdownJson = json_encode($breakdownItems);

        // 3. Save to DB
        $this->db->query("
            INSERT INTO payroll 
            (employee_id, month, year, basic_salary, allowances, deductions, net_salary, breakdown, status, created_by)
            VALUES 
            (:eid, :m, :y, :basic, :allow, :ded, :net, :breakdown, 'Draft', :cb)
            ON DUPLICATE KEY UPDATE 
                basic_salary = :basic, 
                allowances = :allow, 
                deductions = :ded, 
                net_salary = :net, 
                breakdown = :breakdown,
                updated_at = NOW()
        ");
        $this->db->bind(':eid', (int)$employeeId);
        $this->db->bind(':m', (int)$month);
        $this->db->bind(':y', (int)$year);
        $this->db->bind(':basic', $basic);
        $this->db->bind(':allow', $allowances);
        $this->db->bind(':ded', $deductions);
        $this->db->bind(':net', $net);
        $this->db->bind(':breakdown', $breakdownJson);
        $this->db->bind(':cb', $userId);
        
        return $this->db->execute();
    }

    public function updateStatus($id, $status) {
        $sql = "UPDATE payroll SET status = :status";
        if ($status === 'Paid') {
            $sql .= ", paid_at = NOW()";
        }
        $sql .= " WHERE id = :id";
        
        $this->db->query($sql);
        $this->db->bind(':status', $status);
        $this->db->bind(':id', (int)$id);
        
        return $this->db->execute();
    }
}
