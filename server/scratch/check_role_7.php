<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("
    SELECT rp.*, p.perm_key 
    FROM role_permissions rp 
    INNER JOIN permissions p ON p.id = rp.permission_id 
    WHERE rp.role_id = 7
");
$perms = $db->resultSet();

echo "ROLE 7 PERMISSIONS:\n";
print_r($perms);
