<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$locationId = 1;
$db->query("
    SELECT i.*, c.name as customer_name, rt.name as table_name, u.name as steward_name
    FROM pos_held_orders i
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
    LEFT JOIN users u ON i.steward_id = u.id
    WHERE i.location_id = :locId AND i.status = 'pending'
    ORDER BY i.created_at DESC
");
$db->bind(':locId', $locationId);
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
