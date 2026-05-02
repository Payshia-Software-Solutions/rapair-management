<?php
include 'server/config/config.php';
include 'server/app/core/Database.php';
$db = new Database();
try {
    $db->query("ALTER TABLE shipping_costing_sheets 
                ADD COLUMN profit_method VARCHAR(20) DEFAULT 'Markup' AFTER shipment_mode,
                ADD COLUMN profit_value DECIMAL(15,2) DEFAULT 10.00 AFTER profit_method");
    $db->execute();
    echo "Added profit fields to shipping_costing_sheets\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
