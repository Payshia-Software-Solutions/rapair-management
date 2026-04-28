<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

$db->query("DESCRIBE email_campaigns");
print_r($db->resultSet());
