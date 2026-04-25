<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$tables = [
    'invoices', 'invoice_items', 'invoice_payments', 'invoice_taxes', 
    'payment_receipts', 'sales_returns', 'sales_return_items', 
    'customers', 'service_locations'
];

foreach ($tables as $table) {
    echo "========================================\n";
    echo "TABLE: $table\n";
    echo "========================================\n";
    
    echo "--- Columns ---\n";
    $res = $db->query("SHOW FULL COLUMNS FROM $table");
    $cols = $res->fetchAll(PDO::FETCH_ASSOC);
    printf("%-20s | %-20s | %-10s | %-5s | %-10s | %-20s\n", "Field", "Type", "Null", "Key", "Default", "Extra");
    echo str_repeat("-", 100) . "\n";
    foreach ($cols as $c) {
        printf("%-20s | %-20s | %-10s | %-5s | %-10s | %-20s\n", 
            $c['Field'], $c['Type'], $c['Null'], $c['Key'], $c['Default'], $c['Extra']);
    }
    
    echo "\n--- Indexes ---\n";
    $res = $db->query("SHOW INDEX FROM $table");
    $idxs = $res->fetchAll(PDO::FETCH_ASSOC);
    printf("%-20s | %-10s | %-20s | %-20s\n", "Key_name", "Non_unique", "Column_name", "Index_type");
    echo str_repeat("-", 80) . "\n";
    foreach ($idxs as $i) {
        printf("%-20s | %-10s | %-20s | %-20s\n", 
            $i['Key_name'], $i['Non_unique'], $i['Column_name'], $i['Index_type']);
    }
    echo "\n";
}
