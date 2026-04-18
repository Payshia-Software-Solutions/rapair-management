<?php
require_once 'server/app/core/Database.php';

// Mock some environment if needed or just use Database
$db = new Database();
$db->query("SELECT * FROM acc_settings");
print_r($db->resultSet());
