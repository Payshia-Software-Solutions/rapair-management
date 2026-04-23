<?php
/**
 * SalaryTemplateHelper
 * Decoupled helper to manage applying schemes to employees.
 */
class SalaryTemplateHelper {
    /**
     * Apply a global template to an employee by copying its items.
     */
    public static function applyToEmployee($employeeId, $templateId) {
        $db = new Database();
        
        // 1. Get template items
        $db->query("SELECT * FROM hr_salary_template_items WHERE template_id = :tid");
        $db->bind(':tid', (int)$templateId);
        $items = $db->resultSet();
        
        if (empty($items)) return false;

        // 2. Insert into hr_salary_items (recurring per-employee items)
        $success = true;
        foreach ($items as $item) {
            $db->query("
                INSERT INTO hr_salary_items (employee_id, name, amount, type, is_recurring)
                VALUES (:eid, :name, :amount, :type, 1)
            ");
            $db->bind(':eid', (int)$employeeId);
            $db->bind(':name', $item->name);
            $db->bind(':amount', (float)$item->amount);
            $db->bind(':type', $item->type);
            if (!$db->execute()) {
                $success = false;
            }
        }
        
        return $success;
    }
}
