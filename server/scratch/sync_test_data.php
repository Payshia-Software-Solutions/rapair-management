<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

// Fix "Oil Filter" (part_id 1)
$partId = 1;
$locationId = 1;

echo "Synchronizing stock movements for part $partId...\n";

// Clear existing movements for this test case
$db->query("DELETE FROM stock_movements WHERE part_id = :pid AND location_id = :loc");
$db->bind(':pid', $partId);
$db->bind(':loc', $locationId);
$db->execute();

// Get batches
$db->query("SELECT * FROM inventory_batches WHERE part_id = :pid AND location_id = :loc");
$db->bind(':pid', $partId);
$db->bind(':loc', $locationId);
$batches = $db->resultSet();

foreach ($batches as $b) {
    echo "Adding movement for {$b->batch_number} (Qty: {$b->quantity_on_hand})...\n";
    $db->query("
        INSERT INTO stock_movements (
            part_id, location_id, batch_id, movement_type, qty_change, 
            ref_table, ref_id, userId, created_at
        ) VALUES (
            :pid, :loc, :bid, 'Purchase', :qty, 'inventory_batches', :bid, 1, :ca
        )
    ");
    $db->bind(':pid', $partId);
    $db->bind(':loc', $locationId);
    $db->bind(':bid', $b->id);
    $db->bind(':qty', $b->quantity_on_hand);
    $db->bind(':ca', $b->created_at);
    $db->execute();
}

echo "Done.\n";
