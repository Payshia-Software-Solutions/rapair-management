<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

// Get a part that has batches
$db->query("SELECT DISTINCT part_id FROM inventory_batches LIMIT 1");
$row = $db->single();

if ($row) {
    echo "Found part_id with batches: " . $row->part_id . "\n\n";
    
    $partId = $row->part_id;
    
    // Test the Database Query
    $db->query("
        SELECT * FROM inventory_batches 
        WHERE part_id = :pid 
        AND quantity_on_hand > 0 
        AND is_exhausted = 0 
        ORDER BY mfg_date ASC, created_at ASC, id ASC
    ");
    $db->bind(':pid', $partId);
    $batches = $db->resultSet();
    
    echo "Batches for part $partId:\n";
    print_r($batches);
} else {
    echo "No batches found in inventory_batches table.\n";
    
    // Check if there are ANY parts
    $db->query("SELECT id, part_name FROM parts LIMIT 5");
    $parts = $db->resultSet();
    echo "\nAvailable parts:\n";
    print_r($parts);
}
