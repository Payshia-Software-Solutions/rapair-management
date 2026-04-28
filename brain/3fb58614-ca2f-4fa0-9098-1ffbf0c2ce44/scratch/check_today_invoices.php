<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$db->query("SELECT id, invoice_no, customer_id, grand_total, status, created_at FROM invoices WHERE DATE(created_at) = CURDATE()");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
?>
