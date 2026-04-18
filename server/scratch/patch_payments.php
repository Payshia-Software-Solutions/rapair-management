<?php
require_once 'app/core/Database.php';

// Mock Config if needed (usually Database.php expects constants)
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');
if (!defined('DB_NAME')) define('DB_NAME', 'repair_management_db');

$db = new Database();

echo "Running patch for today's payment records...\n";

// 1. Update Payment Receipts location_id based on parent invoice
$db->query("
    UPDATE payment_receipts pr 
    JOIN invoices i ON pr.invoice_id = i.id 
    SET pr.location_id = i.location_id 
    WHERE DATE(pr.created_at) = CURDATE()
");
$db->execute();
$affected1 = $db->rowCount();
echo "Updated $affected1 payment receipts.\n";

// 2. Update Refunds location_id based on parent invoice
$db->query("
    UPDATE refunds r 
    JOIN invoices i ON r.invoice_id = i.id 
    SET r.location_id = i.location_id 
    WHERE DATE(r.created_at) = CURDATE()
");
$db->execute();
$affected2 = $db->rowCount();
echo "Updated $affected2 refunds.\n";

echo "Patching complete.\n";
