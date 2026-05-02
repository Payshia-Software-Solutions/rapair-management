<?php
include 'server/config/config.php';
include 'server/app/core/Database.php';
$db = new Database();
try {
    $db->query("ALTER TABLE shipping_costing_sheets ADD COLUMN shipment_mode VARCHAR(50) DEFAULT 'LCL' AFTER freight_type");
    $db->execute();
    echo "Added shipment_mode to shipping_costing_sheets\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
