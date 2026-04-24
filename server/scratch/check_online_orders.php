<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    $db->query("SELECT id, name FROM service_locations");
    $locations = $db->resultSet();
    echo "LOCATIONS:\n";
    print_r($locations);

    $db->query("SELECT * FROM online_orders");
    $orders = $db->resultSet();
    echo "\nORDERS:\n";
    print_r($orders);
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
