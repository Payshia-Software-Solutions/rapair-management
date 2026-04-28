<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'repair_management_db');
define('DB_USER', 'root');
define('DB_PASS', '');

$dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
$pdo = new PDO($dsn, DB_USER, DB_PASS);
$stmt = $pdo->query("SELECT id, part_name FROM parts WHERE part_name LIKE '%Room%' OR part_name LIKE '%Accom%'");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
