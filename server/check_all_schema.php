<?php
include 'server/config/config.php';
include 'server/app/core/Database.php';
$db = new Database();
$db->query("DESCRIBE shipping_costing_sheets");
$cols = $db->resultSet();
echo "--- shipping_costing_sheets ---\n";
foreach($cols as $col) {
    echo $col->Field . " (" . $col->Type . ")\n";
}
$db->query("DESCRIBE shipping_costing_sheet_products");
$cols = $db->resultSet();
echo "--- shipping_costing_sheet_products ---\n";
foreach($cols as $col) {
    echo $col->Field . " (" . $col->Type . ")\n";
}
