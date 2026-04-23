<?php
require_once 'c:/xampp\htdocs/rapair-management/server/config/config.php';
require_once 'c:/xampp\htdocs/rapair-management/server/app/core/Database.php';

$tables = ['departments', 'technicians', 'users', 'roles'];

try {
    $db = new Database();
    foreach ($tables as $table) {
        echo "\nTable: $table\n";
        $db->query("DESCRIBE $table");
        $rows = $db->resultSet();
        echo json_encode($rows, JSON_PRETTY_PRINT);
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
