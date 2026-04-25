<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('SHOW DATABASES');
print_r($res->fetchAll(PDO::FETCH_COLUMN));
