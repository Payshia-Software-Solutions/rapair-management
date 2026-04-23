<?php
require_once 'c:/xampp/htdocs/rapair-management/server/config/config.php';
require_once 'c:/xampp/htdocs/rapair-management/server/app/core/Database.php';

try {
    $db = new Database();
    $db->query('SHOW TABLES');
    $rows = $db->resultSet();
    echo json_encode($rows, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
