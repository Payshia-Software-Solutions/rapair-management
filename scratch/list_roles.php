<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('SELECT id, name FROM roles');
print_r($res->fetchAll(PDO::FETCH_ASSOC));
