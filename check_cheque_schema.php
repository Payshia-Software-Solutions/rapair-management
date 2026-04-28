<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$db->query("DESCRIBE cheque_inventory");
foreach ($db->resultSet() as $row) {
    echo $row->Field . " (" . $row->Type . ")\n";
}
