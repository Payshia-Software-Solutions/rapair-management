<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

try {
    $db = new Database();
    $db->query('SELECT * FROM system_settings');
    $rows = $db->resultSet();
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
