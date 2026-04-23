<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();
echo "Executing ALTER TABLE...\n";
$sql = "ALTER TABLE cheque_inventory MODIFY COLUMN status ENUM('Pending','Deposited','Cleared','Bounced','Cancelled') NOT NULL DEFAULT 'Pending'";
$db->query($sql);
if ($db->execute()) {
    echo "SUCCESS: Table altered.\n";
} else {
    echo "FAILURE: Could not alter table.\n";
}

$db->query("DESCRIBE cheque_inventory status");
$row = $db->single();
echo "NEW DEFINITION: " . $row->Type . "\n";
