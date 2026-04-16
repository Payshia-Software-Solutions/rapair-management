<?php
define('APPROOT', dirname(__FILE__) . '/app');
require_once APPROOT . '/config/config.php';
require_once APPROOT . '/libraries/Database.php';

$db = new Database();
// Try to get the last 5 completed orders
$db->query("SELECT id, customer_name, vehicle_model, vehicle_identifier, vehicle_id, status FROM repair_orders WHERE status = 'Completed' ORDER BY id DESC LIMIT 5");
$rows = $db->resultSet();

header('Content-Type: application/json');
echo json_encode($rows, JSON_PRETTY_PRINT);
