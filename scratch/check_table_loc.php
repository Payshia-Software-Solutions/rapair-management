<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery("SELECT id, name, location_id FROM restaurant_tables WHERE name = 'VIP Room'");
print_r($res->fetchAll(PDO::FETCH_ASSOC));
