<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Checking BOM for Part ID: 3 (Transmission Fluid)...\n";
$stmt = $pdo->prepare("SELECT * FROM production_boms WHERE output_part_id = 3 AND is_active = 1");
$stmt->execute();
$bom = $stmt->fetch(PDO::FETCH_ASSOC);

if ($bom) {
    echo "Found active BOM ID: " . $bom['id'] . "\n";
    $stmt = $pdo->prepare("SELECT * FROM production_bom_items WHERE bom_id = ?");
    $stmt->execute([$bom['id']]);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo "BOM has " . count($items) . " items.\n";
    foreach ($items as $item) {
        echo " - Part ID: " . $item['part_id'] . ", Qty: " . $item['qty'] . "\n";
    }
} else {
    echo "NO ACTIVE BOM FOUND for Part ID: 3.\n";
}
