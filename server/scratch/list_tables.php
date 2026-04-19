<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();
$db->query("SHOW TABLES");
$tables = $db->resultSet();
foreach ($tables as $table) {
    $tableArr = (array)$table;
    echo array_values($tableArr)[0] . "\n";
}
