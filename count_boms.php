<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Counting all BOMs...\n";
$stmt = $pdo->query("SELECT count(*) FROM production_boms");
echo "Total BOMs: " . $stmt->fetchColumn() . "\n";

echo "\nCounting all BOM Items...\n";
$stmt = $pdo->query("SELECT count(*) FROM production_bom_items");
echo "Total BOM Items: " . $stmt->fetchColumn() . "\n";
