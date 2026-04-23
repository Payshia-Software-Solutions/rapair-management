<?php
require_once 'app/core/Database.php';
define('DB_HOST', 'localhost');
define('DB_NAME', 'repair_management_db');
define('DB_USER', 'root');
define('DB_PASS', '');

try {
    $db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
    $stmt = $db->query("DESCRIBE stock_adjustment_items");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $hasBatchId = false;
    foreach ($columns as $col) {
        echo "Column: " . $col['Field'] . " (" . $col['Type'] . ")\n";
        if ($col['Field'] === 'batch_id') $hasBatchId = true;
    }
    
    if ($hasBatchId) {
        echo "\nSUCCESS: batch_id column exists.\n";
    } else {
        echo "\nFAILURE: batch_id column is MISSING.\n";
        
        // Try to trigger the update manually if missing
        require_once 'app/helpers/InventorySchema.php';
        InventorySchema::ensure(true);
        echo "Attempted force sync...\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
