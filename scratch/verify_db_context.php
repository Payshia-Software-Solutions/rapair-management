<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('SELECT DATABASE() as db');
$row = $res->fetch(PDO::FETCH_ASSOC);
echo "Current Database: " . $row['db'] . "\n";
$res = $db->rawQuery('SHOW TABLES');
echo "Table Count: " . count($res->fetchAll()) . "\n";
