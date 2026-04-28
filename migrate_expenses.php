<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

$colsToAdd = [
    'payee_id' => "INT NULL AFTER voucher_no",
    'payment_method' => "ENUM('Cash', 'Cheque', 'TT', 'Bank Transfer') NOT NULL DEFAULT 'Cash' AFTER payee_name",
    'cheque_no' => "VARCHAR(50) NULL AFTER payment_method",
    'tt_ref_no' => "VARCHAR(50) NULL AFTER cheque_no"
];

foreach ($colsToAdd as $col => $def) {
    try {
        $db->query("ALTER TABLE acc_expenses ADD COLUMN $col $def");
        $db->execute();
        echo "Added $col.\n";
    } catch (Exception $e) {
        echo "Column $col might already exist or error: " . $e->getMessage() . "\n";
    }
}

// Also check indexes
try {
    $db->query("ALTER TABLE acc_expenses ADD INDEX idx_exp_payee (payee_id)");
    $db->execute();
    $db->query("ALTER TABLE acc_expenses ADD INDEX idx_exp_method (payment_method)");
    $db->execute();
    echo "Indexes added.\n";
} catch (Exception $e) {
    echo "Indexes error: " . $e->getMessage() . "\n";
}
