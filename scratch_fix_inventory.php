<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Checking stock_movements schema...\n";
$stmt = $pdo->query("SHOW COLUMNS FROM stock_movements LIKE 'movement_type'");
$col = $stmt->fetch(PDO::FETCH_ASSOC);
echo "Current movement_type: " . $col['Type'] . "\n\n";

if (strpos($col['Type'], 'SALE') === false) {
    echo "SALE missing. Attempting ALTER TABLE...\n";
    try {
        $pdo->exec("ALTER TABLE stock_movements MODIFY COLUMN movement_type ENUM('GRN','ORDER_ISSUE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','PRODUCTION_CONSUMPTION','PRODUCTION_RECEIPT','SALE') NOT NULL");
        echo "ALTER TABLE success.\n";
    } catch (Exception $e) {
        echo "ALTER TABLE failed: " . $e->getMessage() . "\n";
    }
} else {
    echo "SALE already exists in ENUM.\n";
}

echo "\nChecking Transmission Fluid (SKU-20260408-9E0C53)...\n";
$stmt = $pdo->prepare("SELECT id, part_name, sku, recipe_type FROM parts WHERE sku = 'SKU-20260408-9E0C53'");
$stmt->execute();
$part = $stmt->fetch(PDO::FETCH_ASSOC);

if ($part) {
    echo "Found part: " . $part['part_name'] . " (ID: " . $part['id'] . ")\n";
    echo "Recipe Type in DB: " . $part['recipe_type'] . "\n";
    
    if ($part['recipe_type'] !== 'A La Carte') {
        echo "Fixing Recipe Type to 'A La Carte'...\n";
        $pdo->prepare("UPDATE parts SET recipe_type = 'A La Carte' WHERE id = ?")->execute([$part['id']]);
        echo "Update success.\n";
    }
} else {
    echo "Part not found by SKU.\n";
}

// Backfill blank movement types for invoices
echo "\nBackfilling blank movement types for invoices...\n";
$count = $pdo->exec("UPDATE stock_movements SET movement_type = 'SALE' WHERE (movement_type = '' OR movement_type IS NULL) AND ref_table = 'invoices'");
echo "Updated $count rows.\n";
