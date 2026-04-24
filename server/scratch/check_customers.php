<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    $db->query("DESCRIBE customers");
    $schema = $db->resultSet();
    echo "CUSTOMERS SCHEMA:\n";
    foreach ($schema as $row) {
        echo "{$row->Field} - {$row->Type}\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
