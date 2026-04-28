<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/models/PaymentReceipt.php';
$model = new PaymentReceipt();
$data = $model->listAll([]);
echo "Count: " . count($data) . "\n";
echo json_encode(array_slice($data, 0, 5), JSON_PRETTY_PRINT);
?>
