<?php
require 'app/helpers/InventorySchema.php';
require 'app/core/Database.php';

// Define DB constants (adjust if needed, but these are typical for XAMPP)
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'repair_management_db');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Checking stock_transfer_items table...\n";
    
    // Explicitly add batch_id if missing
    $stmt = $pdo->prepare("SHOW COLUMNS FROM stock_transfer_items LIKE 'batch_id'");
    $stmt->execute();
    if (!$stmt->fetch()) {
        echo "Adding batch_id column...\n";
        $pdo->exec("ALTER TABLE stock_transfer_items ADD COLUMN batch_id INT NULL AFTER part_id");
        $pdo->exec("ALTER TABLE stock_transfer_items ADD INDEX idx_sti_batch (batch_id)");
        echo "Success!\n";
    } else {
        echo "batch_id column already exists.\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
