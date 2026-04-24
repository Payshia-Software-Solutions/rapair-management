<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    echo "Adding shipping_fee field to online_orders table...\n";
    
    $db->query("ALTER TABLE online_orders 
                ADD COLUMN IF NOT EXISTS shipping_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER total_amount");
    $db->execute();
    
    // Add a system setting for default shipping fee if not exists
    $db->query("INSERT IGNORE INTO system_settings (setting_key, setting_value) 
                VALUES ('default_shipping_fee', '500')");
    $db->execute();

    echo "Database schema updated successfully.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
