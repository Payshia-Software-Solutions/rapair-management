<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("SELECT * FROM pos_held_orders");
$rows = $db->resultSet();
echo json_encode($rows, JSON_PRETTY_PRINT);
