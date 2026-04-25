<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$res = $db->query('SHOW TABLES');
$tables = $res->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    echo "========================================\n";
    echo "TABLE: $table\n";
    echo "========================================\n";
    
    echo "--- Structure ---\n";
    $res = $db->query("DESCRIBE `$table` ");
    $cols = $res->fetchAll(PDO::FETCH_ASSOC);
    printf("%-25s | %-25s | %-10s | %-5s | %-15s | %-15s\n", "Field", "Type", "Null", "Key", "Default", "Extra");
    echo str_repeat("-", 100) . "\n";
    foreach ($cols as $c) {
        printf("%-25s | %-25s | %-10s | %-5s | %-15s | %-15s\n", 
            $c['Field'], $c['Type'], $c['Null'], $c['Key'], (string)$c['Default'], $c['Extra']);
    }
    
    echo "\n--- Indexes ---\n";
    $res = $db->query("SHOW INDEX FROM `$table` ");
    $idxs = $res->fetchAll(PDO::FETCH_ASSOC);
    printf("%-25s | %-10s | %-25s | %-15s\n", "Key_name", "Non_unique", "Column_name", "Index_type");
    echo str_repeat("-", 80) . "\n";
    foreach ($idxs as $i) {
        printf("%-25s | %-10s | %-25s | %-15s\n", 
            $i['Key_name'], $i['Non_unique'], $i['Column_name'], $i['Index_type']);
    }
    echo "\n\n";
}
