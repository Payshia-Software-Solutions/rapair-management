<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

$stmt = $pdo->query("SELECT b.*, p.part_name FROM production_boms b LEFT JOIN parts p ON p.id = b.output_part_id");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "BOM ID: " . $row['id'] . ", Name: " . $row['name'] . ", Part: " . $row['part_name'] . ", Active: " . $row['is_active'] . "\n";
}
