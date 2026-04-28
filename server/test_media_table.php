<?php
require_once 'config/config.php';
$db = new PDO('mysql:host='.DB_HOST.';dbname='.DB_NAME, DB_USER, DB_PASS);
$stmt=$db->query("SHOW TABLES LIKE 'marketing_media'");
var_dump($stmt->fetchAll());
