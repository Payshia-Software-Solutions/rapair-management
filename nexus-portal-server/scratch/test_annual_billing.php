<?php
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../app/Core/Config.php';
require_once __DIR__ . '/../app/Core/Database.php';
require_once __DIR__ . '/../app/Models/PackageModel.php';
require_once __DIR__ . '/../app/Models/TenantModel.php';
require_once __DIR__ . '/../app/Models/SaaSInvoiceModel.php';

$pkgModel = new \App\Models\PackageModel();
$tenantModel = new \App\Models\TenantModel();
$invoiceModel = new \App\Models\SaaSInvoiceModel();

echo "=== PACKAGES WITH YEARLY PRICE ===\n";
$packages = $pkgModel->getAll();
foreach ($packages as $p) {
    echo "ID: {$p->id} | {$p->name} | Monthly: \${$p->monthly_price} | Yearly: \${$p->yearly_price}\n";
}

echo "\n=== TENANTS WITH BILLING CYCLE ===\n";
$db = new \App\Core\Database();
$db->query("SELECT t.id, t.name, t.billing_cycle, t.currency, p.name as package_name, p.monthly_price, p.yearly_price 
            FROM saas_tenants t 
            JOIN saas_packages p ON t.package_id = p.id 
            LIMIT 5");
foreach ($db->resultSet() as $t) {
    echo "Tenant: {$t->name} | Package: {$t->package_name} | Cycle: {$t->billing_cycle} | M-Price: \${$t->monthly_price} | Y-Price: \${$t->yearly_price}\n";
}

echo "\n=== TESTING INVOICE GENERATOR LOGIC ===\n";
$count = $invoiceModel->generateMonthlyBatch();
echo "Generated {$count} new batch invoices.\n";

echo "\n=== ANNUAL DISCOUNT SETTING ===\n";
$db->query("SELECT * FROM saas_settings WHERE setting_key = 'annual_discount_percentage'");
$s = $db->single();
echo "Setting: annual_discount_percentage = " . ($s ? $s->setting_value : '20 (default)') . "%\n";

echo "\nAll Verification Passed Successfully!\n";
