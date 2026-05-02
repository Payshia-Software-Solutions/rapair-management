<?php
$pdo = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
echo "--- shipping_costing_sheets ---\n";
print_r($pdo->query('SHOW CREATE TABLE shipping_costing_sheets')->fetch());
echo "\n--- shipping_costing_sheet_products ---\n";
print_r($pdo->query('SHOW CREATE TABLE shipping_costing_sheet_products')->fetch());
