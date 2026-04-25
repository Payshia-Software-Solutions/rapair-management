<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');

$checks = [
    'invoices' => 'idx_inv_location',
    'payment_receipts' => 'idx_pr_location',
    'sales_returns' => 'idx_sr_location'
];

echo "Database Optimization Verification\n";
echo "==================================\n";

foreach ($checks as $table => $index) {
    $res = $db->query("SHOW INDEX FROM `$table` WHERE Key_name = '$index'");
    $exists = $res->fetch();
    
    if ($exists) {
        echo "✅ SUCCESS: Table '$table' has index '$index'\n";
    } else {
        echo "❌ FAILED: Table '$table' is MISSING index '$index'\n";
    }
}

echo "\nSchema Documentation Check\n";
echo "==========================\n";
$artifact = 'C:/Users/Thilina-Laptop/.gemini/antigravity/brain/41867bb1-dff2-4d3c-8acc-e96325063eba/database_schema.md';
if (file_exists($artifact)) {
    echo "✅ SUCCESS: Documentation exists at " . basename($artifact) . "\n";
} else {
    echo "❌ FAILED: Documentation artifact is missing.\n";
}
