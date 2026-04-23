<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

$db = new Database();
$db->query("SELECT id, employee_code, avatar_url FROM employees ORDER BY id DESC LIMIT 5");
$results = $db->resultSet();

echo json_encode($results, JSON_PRETTY_PRINT);
