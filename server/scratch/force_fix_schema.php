<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'repair_management_db');
define('DB_USER', 'root');
define('DB_PASS', '');

try {
    $db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Updating stock_adjustment_items schema...\n";
    
    // Check if column exists
    $stmt = $db->query("SHOW COLUMNS FROM stock_adjustment_items LIKE 'batch_id'");
    $exists = $stmt->fetch();
    
    if (!$exists) {
        $db->exec("ALTER TABLE stock_adjustment_items ADD COLUMN batch_id INT NULL AFTER part_id");
        $db->exec("ALTER TABLE stock_adjustment_items ADD INDEX idx_sai_batch (batch_id)");
        echo "SUCCESS: Added batch_id column to stock_adjustment_items.\n";
    } else {
        echo "INFO: batch_id column already exists.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
