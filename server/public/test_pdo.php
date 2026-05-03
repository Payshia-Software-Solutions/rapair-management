<?php
$start = microtime(true);
echo "Connecting to 127.0.0.1...\n";
try {
    $pdo = new PDO("mysql:host=127.0.0.1", "root", "", [
        PDO::ATTR_TIMEOUT => 2,
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    echo "Connected in " . (microtime(true) - $start) . "s\n";
    $stmt = $pdo->query("SELECT 1");
    echo "Query executed in " . (microtime(true) - $start) . "s\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . " after " . (microtime(true) - $start) . "s\n";
}
