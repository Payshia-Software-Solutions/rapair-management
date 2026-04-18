<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SELECT * FROM user_roles");
$roles = $db->resultSet();

echo "USER ROLES:\n";
print_r($roles);
