<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("
    SELECT u.id, u.email, u.role_id, r.name as role_name 
    FROM users u 
    LEFT JOIN roles r ON r.id = u.role_id
");
$users = $db->resultSet();

echo "USER DATA WITH ROLES:\n";
print_r($users);
