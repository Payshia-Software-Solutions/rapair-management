<?php
require_once '../config/config.php';
require_once '../app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('SELECT DATABASE() as db');
$row = $res->fetch(PDO::FETCH_ASSOC);
echo "Database: " . $row['db'] . "<br>";
$res = $db->rawQuery('SHOW TABLES');
$tables = $res->fetchAll(PDO::FETCH_COLUMN);
echo "Table Count: " . count($tables) . "<br>";
echo "Tables: " . implode(', ', $tables) . "<br>";
