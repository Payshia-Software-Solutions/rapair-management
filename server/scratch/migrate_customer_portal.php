<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';

$db = new Database();
try {
    echo "Adding portal access fields to customers table...\n";
    
    // Add password and portal status
    $db->query("ALTER TABLE customers 
                ADD COLUMN IF NOT EXISTS password VARCHAR(255) NULL AFTER email,
                ADD COLUMN IF NOT EXISTS is_portal_active TINYINT(1) DEFAULT 1 AFTER password,
                ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL AFTER is_portal_active");
    $db->execute();
    
    echo "Database schema updated successfully.\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
