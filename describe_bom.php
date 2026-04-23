<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Table production_boms:\n";
$stmt = $pdo->query("DESCRIBE production_boms");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo " - " . $row['Field'] . " (" . $row['Type'] . ")\n";
}
