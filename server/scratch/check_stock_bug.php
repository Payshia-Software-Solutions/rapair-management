<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$sku = 'SKU-20280408-483331';
$db->query("SELECT id, part_name FROM parts WHERE sku = :sku");
$db->bind(':sku', $sku);
$part = $db->single();

if (!$part) {
    echo "Part not found for SKU: $sku\n";
    exit;
}

$partId = $part->id;
$locationId = 1; // Peak view Service Center

echo "Part: {$part->part_name} (ID: $partId)\n";

// 1. Check stock_movements balance
$db->query("SELECT SUM(qty_change) as total FROM stock_movements WHERE part_id = :pid AND location_id = :lid");
$db->bind(':pid', $partId);
$db->bind(':lid', $locationId);
$movBalance = $db->single();
echo "Stock Movements Balance for Location 1: " . ($movBalance->total ?? 0) . "\n";

// 2. Check inventory_batches balance
$db->query("SELECT SUM(quantity_on_hand) as total FROM inventory_batches WHERE part_id = :pid AND location_id = :lid AND is_exhausted = 0");
$db->bind(':pid', $partId);
$db->bind(':lid', $locationId);
$batchBalance = $db->single();
echo "Inventory Batches Balance for Location 1: " . ($batchBalance->total ?? 0) . "\n";

// 3. List all movements for this part
$db->query("SELECT * FROM stock_movements WHERE part_id = :pid ORDER BY id DESC LIMIT 10");
$db->bind(':pid', $partId);
$movements = $db->resultSet();
echo "\nRecent Movements:\n";
print_r($movements);

// 4. List all batches for this part
$db->query("SELECT * FROM inventory_batches WHERE part_id = :pid ORDER BY id DESC");
$db->bind(':pid', $partId);
$batches = $db->resultSet();
echo "\nAll Batches:\n";
print_r($batches);
