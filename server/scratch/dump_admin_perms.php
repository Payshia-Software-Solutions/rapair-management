<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SELECT * FROM permissions");
$perms = $db->resultSet();
echo "PERMISSIONS:\n";
print_r($perms);

$db->query("SELECT * FROM role_permissions WHERE role_id = 1");
$adminPerms = $db->resultSet();
echo "\nADMIN (Role 1) PERMISSION IDs:\n";
print_r($adminPerms);
