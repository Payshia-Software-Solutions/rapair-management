<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Checking ALL BOMs for Part ID: 3 (Transmission Fluid)...\n";
$stmt = $pdo->prepare("SELECT * FROM production_boms WHERE output_part_id = 3");
$stmt->execute();
$boms = $stmt->fetchAll(PDO::FETCH_ASSOC);

if ($boms) {
    echo "Found " . count($boms) . " BOMs.\n";
    foreach ($boms as $bom) {
        echo " - BOM ID: " . $bom['id'] . ", Name: " . $bom['name'] . ", Active: " . $bom['is_active'] . "\n";
    }
} else {
    echo "NO BOMs FOUND for Part ID: 3.\n";
}
