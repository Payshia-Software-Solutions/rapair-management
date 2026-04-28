<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$db->query("SELECT COUNT(*) as total FROM payment_receipts");
echo json_encode($db->single());
?>
