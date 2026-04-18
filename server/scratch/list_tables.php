<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SHOW TABLES");
$tables = $db->resultSet();
echo "TABLES:\n";
print_r($tables);

foreach ($tables as $t) {
    $tableName = array_values((array)$t)[0];
    if (stripos($tableName, 'role') !== false || stripos($tableName, 'perm') !== false) {
        echo "\nCONTENT OF $tableName:\n";
        $db->query("SELECT * FROM $tableName");
        print_r($db->resultSet());
    }
}
