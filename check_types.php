<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

$stmt = $pdo->query("SELECT part_name, recipe_type FROM parts WHERE id IN (1, 2)");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "Part: " . $row['part_name'] . ", Recipe Type: " . $row['recipe_type'] . "\n";
}
