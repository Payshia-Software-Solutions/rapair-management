<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery("
    SELECT u.id, u.name, r.name as role, u.location_id, u.is_active 
    FROM users u 
    INNER JOIN roles r ON r.id = u.role_id
");
print_r($res->fetchAll(PDO::FETCH_ASSOC));
