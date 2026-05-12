<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("
    SELECT p.perm_key
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN roles r ON r.id = rp.role_id
    WHERE r.name = 'admin'
");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
