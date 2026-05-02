<?php
$pdo = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');

try {
    echo "Updating shipping_costing_sheets...\n";
    $pdo->exec("ALTER TABLE shipping_costing_sheets ADD COLUMN IF NOT EXISTS overhead_absorption_method VARCHAR(50) DEFAULT 'Value'");
    $pdo->exec("ALTER TABLE shipping_costing_sheets ADD COLUMN IF NOT EXISTS target_currency VARCHAR(10) DEFAULT 'USD'");
    $pdo->exec("ALTER TABLE shipping_costing_sheets ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15,4) DEFAULT 1.0000");

    echo "Updating shipping_costing_sheet_items...\n";
    $pdo->exec("ALTER TABLE shipping_costing_sheet_items MODIFY COLUMN cost_type VARCHAR(50)");
    $pdo->exec("ALTER TABLE shipping_costing_sheet_items ADD COLUMN IF NOT EXISTS absorption_method VARCHAR(50) DEFAULT 'Value'");

    echo "Schema updated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
