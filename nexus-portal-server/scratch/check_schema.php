<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../app/Core/Config.php';
require_once __DIR__ . '/../app/Core/Database.php';

$db = new \App\Core\Database();

echo "=== SAAS_PACKAGES ===\n";
$db->query("DESCRIBE saas_packages");
foreach ($db->resultSet() as $col) {
    echo "{$col->Field} - {$col->Type}\n";
}

echo "\n=== SAAS_TENANTS ===\n";
$db->query("DESCRIBE saas_tenants");
foreach ($db->resultSet() as $col) {
    echo "{$col->Field} - {$col->Type}\n";
}

echo "\n=== SAAS_INVOICES ===\n";
$db->query("DESCRIBE saas_invoices");
foreach ($db->resultSet() as $col) {
    echo "{$col->Field} - {$col->Type}\n";
}
