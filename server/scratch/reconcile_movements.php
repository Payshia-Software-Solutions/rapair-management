<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

echo "Starting Stock Movement Reconciliation...\n";

// 1. Find all batches with positive stock
$db->query("SELECT * FROM inventory_batches WHERE quantity_on_hand > 0 AND is_exhausted = 0");
$batches = $db->resultSet();

$fixedCount = 0;
foreach ($batches as $b) {
    // Check existing movements for this specific batch
    $db->query("SELECT COALESCE(SUM(qty_change), 0) as total FROM stock_movements WHERE batch_id = :bid");
    $db->bind(':bid', $b->id);
    $res = $db->single();
    $movTotal = (float)($res->total ?? 0);
    
    $batchTotal = (float)$b->quantity_on_hand;
    
    if (abs($batchTotal - $movTotal) > 0.0001) {
        $diff = round($batchTotal - $movTotal, 3);
        echo "Batch #{$b->id} (Part ID: {$b->part_id}, Loc: {$b->location_id}): Ledger diff found: $diff\n";
        
        // Create reconciliation movement
        $db->query("
            INSERT INTO stock_movements 
            (location_id, part_id, batch_id, qty_change, movement_type, notes, created_by)
            VALUES 
            (:loc, :pid, :bid, :qty, 'RECONCILED', 'Automated Reconciliation (Sync with Batch)', 1)
        ");
        $db->bind(':loc', $b->location_id);
        $db->bind(':pid', $b->part_id);
        $db->bind(':bid', $b->id);
        $db->bind(':qty', $diff);
        $db->execute();
        $fixedCount++;
    }
}

echo "\nReconciliation Complete. Fixed $fixedCount batches.\n";

// 2. Part-level check (for stock that isn't in any batch)
// This is more complex, but for now we've synced the batches.
