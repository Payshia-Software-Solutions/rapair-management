<?php
include 'server/config/config.php';
include 'server/app/core/Database.php';
$db = new Database();
$db->query("DESCRIBE shipping_costing_sheets");
$cols = $db->resultSet();
foreach($cols as $col) {
    echo $col->Field . " (" . $col->Type . ")\n";
}
