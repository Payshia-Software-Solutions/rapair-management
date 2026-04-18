<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SELECT * FROM service_locations");
$rows = $db->resultSet();

echo "Service Locations:\n";
print_r($rows);
