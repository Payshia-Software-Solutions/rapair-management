<?php
require_once 'app/core/Database.php';
require_once 'app/core/Model.php';
require_once 'app/models/PaymentReceipt.php';
require_once 'config/config.php';

// Instantiate model to trigger ensureSchema
$model = new PaymentReceipt();

$db = new Database();
$db->query("DESCRIBE cheque_inventory status");
$row = $db->single();

echo "CHEQUE STATUS ENUM DEFINITION:\n";
print_r($row->Type);
echo "\n";
