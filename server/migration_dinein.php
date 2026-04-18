<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

$db = new Database();

// 1. Ensure Steward role exists
$db->query("SELECT id FROM roles WHERE name = 'Steward'");
if (!$db->single()) {
    $db->query("INSERT INTO roles (name) VALUES ('Steward')");
    $db->execute();
    echo "Steward role created.\n";
} else {
    echo "Steward role already exists.\n";
}

// 2. Create restaurant_tables table
$db->query("
    CREATE TABLE IF NOT EXISTS restaurant_tables (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        location_id INT NOT NULL,
        status ENUM('Available', 'Occupied', 'Reserved', 'Out of Service') DEFAULT 'Available',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_table_location (location_id)
    )
");
$db->execute();
echo "restaurant_tables table ensured.\n";

// 3. Ensure order_type exists
try {
    $db->query("SELECT order_type FROM invoices LIMIT 1");
    $db->execute();
} catch (Exception $e) {
    $db->query("ALTER TABLE invoices ADD COLUMN order_type VARCHAR(20) DEFAULT 'retail' AFTER grand_total");
    $db->execute();
    echo "order_type column added.\n";
}

// 4. Add table_id and steward_id to invoices if not present
try {
    $db->query("SELECT table_id FROM invoices LIMIT 1");
    $db->execute();
} catch (Exception $e) {
    $db->query("ALTER TABLE invoices ADD COLUMN table_id INT NULL AFTER order_type, ADD COLUMN steward_id INT NULL AFTER table_id");
    $db->execute();
    echo "Invoice columns (table_id, steward_id) added.\n";
}
echo "Migration completed successfully.\n";
