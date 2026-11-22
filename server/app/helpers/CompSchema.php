<?php
/**
 * CompSchema
 * Tables/columns for complimentary (comp) items on POS bills.
 *
 * Unlike most schema helpers this one is not gated behind FORCE_MIGRATIONS: invoice creation
 * writes the comp columns, so they must exist. It costs one cheap check per request and only
 * runs DDL when something is missing. Call it BEFORE starting a transaction (DDL commits).
 */
class CompSchema {
    private static $done = false;

    public static function ensure() {
        if (self::$done) return;
        self::$done = true;

        try {
            $pdo = new PDO('mysql:host=' . DB_HOST . ';dbname=' . DB_NAME, DB_USER, DB_PASS);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Fast path: the last thing added below already exists
            if (self::hasColumn($pdo, 'roles', 'comp_limit') && self::hasTable($pdo, 'pos_comp_approvals')) return;

            // One approval = one manager PIN check. The token covers comp lines worth up to amount_limit
            // and is used once, by the invoice that settles them.
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS pos_comp_approvals (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    token CHAR(40) NOT NULL,
                    approver_id INT NOT NULL,
                    requested_by INT NULL,
                    reason VARCHAR(255) NOT NULL,
                    amount_limit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                    held_order_id INT NULL,
                    invoice_id INT NULL,
                    used_at DATETIME NULL,
                    expires_at DATETIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_comp_token (token),
                    INDEX idx_comp_invoice (invoice_id),
                    INDEX idx_comp_approver (approver_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");

            $cols = [
                'invoice_items' => [
                    'is_complimentary' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'comp_reason' => "VARCHAR(255) NULL",
                    'comp_approved_by' => "INT NULL",
                    'comp_amount' => "DECIMAL(12,2) NOT NULL DEFAULT 0.00",
                ],
                'pos_held_order_items' => [
                    'is_complimentary' => "TINYINT(1) NOT NULL DEFAULT 0",
                    'comp_reason' => "VARCHAR(255) NULL",
                    'comp_token' => "CHAR(40) NULL",
                ],
                // Most a member of this role can comp in one approval. NULL = no limit.
                'roles' => [
                    'comp_limit' => "DECIMAL(12,2) NULL",
                ],
            ];
            foreach ($cols as $table => $defs) {
                if (!self::hasTable($pdo, $table)) continue;
                foreach ($defs as $col => $def) {
                    if (!self::hasColumn($pdo, $table, $col)) {
                        $pdo->exec("ALTER TABLE `$table` ADD COLUMN `$col` $def");
                    }
                }
            }

            $pdo->exec("INSERT IGNORE INTO permissions (perm_key, description)
                        VALUES ('pos.comp', 'Approve complimentary (free) items on POS bills with a PIN')");
        } catch (Exception $e) {
            error_log('CompSchema: ' . $e->getMessage());
        }
    }

    private static function hasTable(PDO $pdo, $table) {
        return (bool)$pdo->query("SHOW TABLES LIKE " . $pdo->quote($table))->fetch();
    }

    private static function hasColumn(PDO $pdo, $table, $col) {
        try {
            return (bool)$pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($col))->fetch();
        } catch (Exception $e) {
            return false;
        }
    }
}
