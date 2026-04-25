<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('DESCRIBE restaurant_tables');
print_r($res->fetchAll(PDO::FETCH_ASSOC));
$res = $db->rawQuery('SELECT count(*) as total FROM restaurant_tables');
print_r($res->fetch(PDO::FETCH_ASSOC));
