<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$db->query("SELECT name, type, code FROM acc_accounts");
$res = $db->resultSet();

echo "Total Accounts: " . count($res) . "\n";
foreach ($res as $row) {
    echo "Name: {$row->name} | Type: {$row->type} | Code: {$row->code}\n";
}
