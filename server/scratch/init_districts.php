<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    echo "Creating districts table...\n";
    
    $db->query("CREATE TABLE IF NOT EXISTS districts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        shipping_zone_id INT NULL,
        FOREIGN KEY (shipping_zone_id) REFERENCES shipping_zones(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $db->execute();

    // Seed Sri Lankan Districts
    $db->query("SELECT COUNT(*) as count FROM districts");
    if ($db->single()->count == 0) {
        echo "Seeding Sri Lankan districts...\n";
        $districts = [
            'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 
            'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 
            'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 
            'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 
            'Moneragala', 'Ratnapura', 'Kegalle'
        ];

        // Map some defaults to existing zones
        // Zone 1: Colombo & Suburbs (ID 1)
        // Zone 2: Gampaha (ID 2)
        // Zone 3: Outstation (ID 3)
        
        foreach ($districts as $name) {
            $zoneId = 3; // Default Outstation
            if ($name == 'Colombo') $zoneId = 1;
            if ($name == 'Gampaha') $zoneId = 2;
            
            $db->query("INSERT INTO districts (name, shipping_zone_id) VALUES (:name, :zone_id)");
            $db->bind(':name', $name);
            $db->bind(':zone_id', $zoneId);
            $db->execute();
        }
    }

    // Update online_orders to include district_id
    $db->query("ALTER TABLE online_orders 
                ADD COLUMN IF NOT EXISTS district_id INT NULL AFTER shipping_zone_id,
                ADD FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE SET NULL");
    $db->execute();

    echo "District verification schema updated successfully.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
