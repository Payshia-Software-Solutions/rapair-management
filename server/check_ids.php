<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
    $customer = $pdo->query("SELECT id FROM customers ORDER BY id LIMIT 1")->fetch();
    $part = $pdo->query("SELECT id FROM parts ORDER BY id LIMIT 1")->fetch();
    echo "Customer ID: " . ($customer['id'] ?? 'NONE') . "\n";
    echo "Part ID: " . ($part['id'] ?? 'NONE') . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
