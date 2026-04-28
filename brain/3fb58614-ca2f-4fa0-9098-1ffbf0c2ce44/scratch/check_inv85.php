<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$db->query("SELECT * FROM payment_receipts WHERE invoice_no = 'INV000085'");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
?>
