<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();
$db->query("DESCRIBE parts");
$cols = $db->resultSet();
print_r($cols);

$db->query("SELECT * FROM parts WHERE part_name LIKE '%Labour%' LIMIT 1");
$sample = $db->single();
print_r($sample);
