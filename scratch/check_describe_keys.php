<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
$db = new Database();
$res = $db->rawQuery('DESCRIBE `users`');
$c = $res->fetch(PDO::FETCH_ASSOC);
echo json_encode(array_keys($c));
echo "\n";
echo json_encode($c);
