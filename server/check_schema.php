<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
$db = new Database();
$db->query("DESCRIBE invoices");
$rows = $db->resultSet();
foreach($rows as $r) {
    echo "{$r->Field}: {$r->Type}\n";
}
