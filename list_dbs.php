<?php
require_once 'server/config/Config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Listing databases...\n";
$stmt = $pdo->query("SHOW DATABASES");
while ($row = $stmt->fetchColumn()) {
    echo " - $row\n";
}

echo "\nCurrent Database: " . DB_NAME . "\n";
