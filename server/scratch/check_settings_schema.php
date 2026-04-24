<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    $db->query("DESCRIBE system_settings");
    print_r($db->resultSet());
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
