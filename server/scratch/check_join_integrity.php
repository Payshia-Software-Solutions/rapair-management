<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("
    SELECT i.id, i.customer_id, c.id as join_id
    FROM pos_held_orders i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.status = 'pending'
");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
