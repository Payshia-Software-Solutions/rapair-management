<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Movement Type Column Detail:\n";
$stmt = $pdo->query("SHOW FULL COLUMNS FROM stock_movements LIKE 'movement_type'");
$row = $stmt->fetch(PDO::FETCH_ASSOC);
print_r($row);
