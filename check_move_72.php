<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Checking Stock Movement ID 72...\n";
$stmt = $pdo->prepare("SELECT * FROM stock_movements WHERE id = 72");
$stmt->execute();
$row = $stmt->fetch(PDO::FETCH_ASSOC);
print_r($row);
