<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'repair_management_db');

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $dbh = new PDO($dsn, DB_USER, DB_PASS);
    
    // 1. Add hs_code to parts
    $dbh->exec("ALTER TABLE parts ADD COLUMN hs_code VARCHAR(32) DEFAULT NULL AFTER packing_type");
    echo "Added hs_code to parts table.\n";
    
    // 2. Add hs_code to shipping_costing_sheet_products
    $dbh->exec("ALTER TABLE shipping_costing_sheet_products ADD COLUMN hs_code VARCHAR(32) DEFAULT NULL AFTER packing_type");
    echo "Added hs_code to shipping_costing_sheet_products table.\n";
    
} catch (Exception $e) {
    echo $e->getMessage() . "\n";
}
