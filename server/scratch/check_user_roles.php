<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("
    SELECT u.id, u.name, r.name as role_name
    FROM users u
    INNER JOIN roles r ON r.id = u.role_id
");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
