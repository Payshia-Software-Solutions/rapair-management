<?php
/**
 * Tables for the approval workflow (see helpers/Approval.php).
 * Created on first use, so no manual migration is needed; also run by "Run migrations".
 *
 *   approval_doc_types   one row per document type: on/off, email/SMS notifications
 *   approval_levels      ordered levels per type: role or person, optional min amount / location
 *   approval_requests    one per document sent for approval (status + current level)
 *   approval_actions     audit trail: submitted / approved / rejected, with comments
 */
class ApprovalSchema {
    private static $done = false;

    public static function ensure($force = false) {
        if (self::$done && !$force) return;
        self::$done = true;
        $db = new Database();
        $pdo = $db->getDb();
        if (!$force) {
            $exists = $pdo->query("SHOW TABLES LIKE 'approval_actions'")->fetchColumn();
            $col = $pdo->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'status'")->fetchColumn();
            $hasPayload = $exists ? $pdo->query("SHOW COLUMNS FROM approval_requests LIKE 'payload'")->fetchColumn() : false;
            if ($exists && $hasPayload && (!$col || strpos($col, 'Pending Approval') !== false)) return;
        }

        $pdo->exec("CREATE TABLE IF NOT EXISTS approval_doc_types (
            doc_type VARCHAR(40) PRIMARY KEY,
            enabled TINYINT(1) NOT NULL DEFAULT 0,
            notify_email TINYINT(1) NOT NULL DEFAULT 1,
            notify_sms TINYINT(1) NOT NULL DEFAULT 0,
            updated_by INT NULL,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS approval_levels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            doc_type VARCHAR(40) NOT NULL,
            level_no INT NOT NULL,
            label VARCHAR(100) NULL,
            approver_type ENUM('role','user') NOT NULL DEFAULT 'role',
            role_id INT NULL,
            user_id INT NULL,
            min_amount DECIMAL(15,2) NULL,
            location_id INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_al_type (doc_type, level_no)
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS approval_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            doc_type VARCHAR(40) NOT NULL,
            doc_id INT NOT NULL,
            doc_no VARCHAR(100) NULL,
            summary VARCHAR(255) NULL,
            amount DECIMAL(15,2) NULL,
            location_id INT NULL,
            requested_by INT NULL,
            status ENUM('Pending','Approved','Rejected','Withdrawn') NOT NULL DEFAULT 'Pending',
            current_level INT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ar_doc (doc_type, doc_id),
            INDEX idx_ar_status (status, doc_type)
        )");

        $pdo->exec("CREATE TABLE IF NOT EXISTS approval_actions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            request_id INT NOT NULL,
            level_no INT NULL,
            user_id INT NULL,
            action ENUM('Submitted','Approved','Rejected','Withdrawn') NOT NULL,
            comment VARCHAR(500) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_aa_req (request_id)
        )");

        // Purchase orders wait in 'Pending Approval' while their approval runs.
        $col = $pdo->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'purchase_orders' AND COLUMN_NAME = 'status'")->fetchColumn();
        if ($col && strpos($col, 'Pending Approval') === false) {
            $pdo->exec("ALTER TABLE purchase_orders MODIFY status ENUM('Draft','Pending Approval','Approved','Sent','Partially Received','Received','Cancelled') NOT NULL DEFAULT 'Draft'");
        }

        // Documents that only exist after approval (stock adjustments) keep their details here.
        if (!$pdo->query("SHOW COLUMNS FROM approval_requests LIKE 'payload'")->fetchColumn()) {
            $pdo->exec("ALTER TABLE approval_requests ADD COLUMN payload MEDIUMTEXT NULL AFTER summary");
        }

        // Optional phone on users, for SMS approval alerts.
        $hasPhone = $pdo->query("SHOW COLUMNS FROM users LIKE 'phone'")->fetchColumn();
        if (!$hasPhone) $pdo->exec("ALTER TABLE users ADD COLUMN phone VARCHAR(30) NULL AFTER email");
    }
}
