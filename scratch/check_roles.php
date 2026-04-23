<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

echo "Roles:\n";
$db->query("SELECT * FROM roles");
print_r($db->resultSet());

echo "\nHRM Permissions:\n";
$db->query("SELECT * FROM permissions WHERE perm_key LIKE 'hrm%'");
print_r($db->resultSet());

echo "\nRole Permissions (hrm.write mappings):\n";
$db->query("
    SELECT r.name as role, p.perm_key
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.perm_key = 'hrm.write'
");
print_r($db->resultSet());
