<?php
require_once 'app/core/Database.php';
if(!defined('DB_HOST')) define('DB_HOST','localhost');
if(!defined('DB_USER')) define('DB_USER','root');
if(!defined('DB_PASS')) define('DB_PASS','');
if(!defined('DB_NAME')) define('DB_NAME','repair_management_db');

$db = new Database();
$db->query("SELECT id, invoice_id, amount, payment_method, location_id, created_at FROM payment_receipts WHERE DATE(created_at) = CURDATE()");
$rows = $db->resultSet();
echo "--- TODAY'S RECEIPTS ---\n";
print_r($rows);

$db->query("SELECT id, invoice_no, grand_total, status, location_id, created_at FROM invoices WHERE DATE(created_at) = CURDATE()");
$rows = $db->resultSet();
echo "--- TODAY'S INVOICES ---\n";
print_r($rows);
