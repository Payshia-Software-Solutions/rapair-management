<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SELECT id, username, role, allowed_location_ids FROM users");
$users = $db->resultSet();

$db->query("SELECT id, name FROM service_locations");
$locs = $db->resultSet();

echo "USER DATA:\n";
print_r($users);
echo "\nLOCATION DATA:\n";
print_r($locs);
