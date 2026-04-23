<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Updating ENUM to include ALL types...\n";
try {
    $pdo->exec("ALTER TABLE stock_movements MODIFY COLUMN movement_type ENUM('GRN','ORDER_ISSUE','ADJUSTMENT','TRANSFER_IN','TRANSFER_OUT','PRODUCTION_CONSUMPTION','PRODUCTION_RECEIPT','SALE','SALES_RETURN','PURCHASE_RETURN') NOT NULL");
    echo "ALTER TABLE success.\n";
} catch (Exception $e) {
    echo "ALTER TABLE failed: " . $e->getMessage() . "\n";
}

echo "\nBackfilling ALL blank types...\n";

// Sales Returns
$count = $pdo->exec("UPDATE stock_movements SET movement_type = 'SALES_RETURN' WHERE (movement_type = '' OR movement_type IS NULL) AND ref_table = 'sales_returns'");
echo "- Sales Returns: $count updated\n";

// Production Consumption
$count = $pdo->exec("UPDATE stock_movements SET movement_type = 'PRODUCTION_CONSUMPTION' WHERE (movement_type = '' OR movement_type IS NULL) AND (notes LIKE 'Production Consumption%' OR notes LIKE 'BOM Consumption%')");
echo "- Production Consumption: $count updated\n";

// Production Receipt
$count = $pdo->exec("UPDATE stock_movements SET movement_type = 'PRODUCTION_RECEIPT' WHERE (movement_type = '' OR movement_type IS NULL) AND (notes LIKE 'Production Entry%' OR notes LIKE 'A La Carte Assembly%')");
echo "- Production Receipt: $count updated\n";

// Standard Sales
$count = $pdo->exec("UPDATE stock_movements SET movement_type = 'SALE' WHERE (movement_type = '' OR movement_type IS NULL) AND ref_table = 'invoices'");
echo "- Sales: $count updated\n";

echo "\nAll done.\n";
