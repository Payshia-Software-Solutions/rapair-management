<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();
$locationId = 1; // From user screenshot

echo "STOCKS AUDIT FOR LOCATION $locationId:\n";
echo str_pad("PART NAME", 30) . " | " . str_pad("MOV TOTAL", 10) . " | " . str_pad("BATCH TOTAL", 12) . " | " . str_pad("SKU", 20) . "\n";
echo str_repeat("-", 85) . "\n";

$db->query("SELECT id, part_name, sku FROM parts ORDER BY part_name ASC");
$parts = $db->resultSet();

foreach ($parts as $p) {
    // Movement total
    $db->query("SELECT SUM(qty_change) as total FROM stock_movements WHERE part_id = :pid AND location_id = :lid");
    $db->bind(':pid', $p->id);
    $db->bind(':lid', $locationId);
    $movTotal = (float)($db->single()->total ?? 0);

    // Batch total
    $db->query("SELECT SUM(quantity_on_hand) as total FROM inventory_batches WHERE part_id = :pid AND location_id = :lid AND is_exhausted = 0");
    $db->bind(':pid', $p->id);
    $db->bind(':lid', $locationId);
    $batchTotal = (float)($db->single()->total ?? 0);

    echo str_pad(substr($p->part_name, 0, 30), 30) . " | " . 
         str_pad(number_format($movTotal, 3), 10, " ", STR_PAD_LEFT) . " | " . 
         str_pad(number_format($batchTotal, 3), 12, " ", STR_PAD_LEFT) . " | " . 
         str_pad($p->sku, 20) . "\n";
}
