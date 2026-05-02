<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("SELECT * FROM customers WHERE id = 2");
$row = $db->single();
echo json_encode($row, JSON_PRETTY_PRINT);
