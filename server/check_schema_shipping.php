<?php
$pdo = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
echo "--- shipping_costing_sheets ---\n";
print_r($pdo->query('DESCRIBE shipping_costing_sheets')->fetchAll(PDO::FETCH_ASSOC));
echo "\n--- shipping_costing_sheet_items ---\n";
print_r($pdo->query('DESCRIBE shipping_costing_sheet_items')->fetchAll(PDO::FETCH_ASSOC));
echo "\n--- shipping_costing_sheet_products ---\n";
print_r($pdo->query('DESCRIBE shipping_costing_sheet_products')->fetchAll(PDO::FETCH_ASSOC));
