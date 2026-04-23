<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();
$db->query("DESCRIBE cheque_inventory status");
$row = $db->single();

echo "DESCRIBE KEY CASE CHECK:\n";
print_r($row);
