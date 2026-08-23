<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../app/Core/Config.php';
require_once __DIR__ . '/../app/Core/Database.php';

$db = new \App\Core\Database();

echo "Starting Annual Billing Database Migration...\n";

// 1. Check & Add yearly_price to saas_packages
try {
    $db->query("SHOW COLUMNS FROM saas_packages LIKE 'yearly_price'");
    $col = $db->single();
    if (!$col) {
        echo "Adding 'yearly_price' column to 'saas_packages'...\n";
        $db->query("ALTER TABLE saas_packages ADD COLUMN yearly_price DECIMAL(10,2) NULL DEFAULT NULL AFTER monthly_price");
        $db->execute();
        echo "Successfully added 'yearly_price'.\n";
    } else {
        echo "'yearly_price' already exists in 'saas_packages'.\n";
    }

    // Backfill yearly_price with 20% annual discount if null or 0
    echo "Updating default yearly_prices (monthly_price * 12 * 0.8)...\n";
    $db->query("UPDATE saas_packages SET yearly_price = ROUND(monthly_price * 12 * 0.80, 2) WHERE yearly_price IS NULL OR yearly_price = 0");
    $db->execute();
    echo "Yearly prices updated.\n";
} catch (Exception $e) {
    echo "Error updating saas_packages: " . $e->getMessage() . "\n";
}

// 2. Check & Add billing_cycle to saas_tenants
try {
    $db->query("SHOW COLUMNS FROM saas_tenants LIKE 'billing_cycle'");
    $col = $db->single();
    if (!$col) {
        echo "Adding 'billing_cycle' column to 'saas_tenants'...\n";
        $db->query("ALTER TABLE saas_tenants ADD COLUMN billing_cycle ENUM('monthly', 'yearly') NOT NULL DEFAULT 'monthly' AFTER currency");
        $db->execute();
        echo "Successfully added 'billing_cycle'.\n";
    } else {
        echo "'billing_cycle' already exists in 'saas_tenants'.\n";
    }
} catch (Exception $e) {
    echo "Error updating saas_tenants: " . $e->getMessage() . "\n";
}

// Verify current packages
echo "\n--- CURRENT PACKAGES ---\n";
$db->query("SELECT id, name, package_key, monthly_price, yearly_price FROM saas_packages");
foreach ($db->resultSet() as $p) {
    echo "ID: {$p->id} | Name: {$p->name} | Monthly: \${$p->monthly_price} | Yearly: \${$p->yearly_price}\n";
}

// Verify tenants
echo "\n--- TENANTS (first 5) ---\n";
$db->query("SELECT id, name, slug, currency, billing_cycle, trial_expiry FROM saas_tenants LIMIT 5");
foreach ($db->resultSet() as $t) {
    echo "ID: {$t->id} | Name: {$t->name} | Cycle: {$t->billing_cycle} | Expiry: {$t->trial_expiry}\n";
}

echo "\nMigration Complete!\n";
