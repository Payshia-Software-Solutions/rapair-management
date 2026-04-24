<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();
$db->query("
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '" . DB_NAME . "' AND DATA_TYPE = 'enum'
");
$enums = $db->resultSet();

echo "=== ENUM DEFINITIONS ===\n";
foreach ($enums as $e) {
    echo "{$e->TABLE_NAME}.{$e->COLUMN_NAME} => {$e->COLUMN_TYPE}\n";
}

echo "\n=== TABLES ===\n";
$db->query("SHOW TABLES");
$tables = $db->resultSet();
foreach ($tables as $t) {
    $prop = "Tables_in_" . DB_NAME;
    echo $t->$prop . "\n";
}
