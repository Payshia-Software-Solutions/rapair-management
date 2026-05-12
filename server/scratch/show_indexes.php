<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();

$tableName = $argv[1] ?? 'audit_logs';

echo "--- INDEXES FOR TABLE: $tableName ---\n";
try {
    $db->query("SHOW INDEX FROM $tableName");
    $indexes = $db->resultSet();

    foreach ($indexes as $index) {
        printf("Key: %-20s | Column: %-20s | Non_unique: %d\n", 
            $index->Key_name, 
            $index->Column_name, 
            $index->Non_unique
        );
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
