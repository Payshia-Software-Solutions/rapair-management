<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    echo "Creating shipping_zones table...\n";
    
    $db->query("CREATE TABLE IF NOT EXISTS shipping_zones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        base_fee DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        free_threshold DECIMAL(15,2) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->execute();

    // Add some default zones for Sri Lanka context
    $db->query("SELECT COUNT(*) as count FROM shipping_zones");
    if ($db->single()->count == 0) {
        echo "Seeding default shipping zones...\n";
        $db->query("INSERT INTO shipping_zones (name, base_fee, free_threshold) VALUES 
            ('Colombo & Suburbs', 350.00, 5000.00),
            ('Gampaha District', 450.00, 7500.00),
            ('Outstation (Standard)', 600.00, 15000.00),
            ('Express Delivery (All Island)', 1200.00, NULL)");
        $db->execute();
    }

    // Add shipping_zone_id to online_orders
    $db->query("ALTER TABLE online_orders 
                ADD COLUMN IF NOT EXISTS shipping_zone_id INT NULL AFTER shipping_fee,
                ADD FOREIGN KEY (shipping_zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL");
    $db->execute();

    echo "Database schema updated successfully.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
