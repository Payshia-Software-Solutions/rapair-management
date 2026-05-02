<?php
$host = 'localhost';
$db   = 'repair_management_db';
$user = 'root';
$pass = '';
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    
    // Add profit_base to products table
    $pdo->exec("ALTER TABLE shipping_costing_sheet_products 
                ADD COLUMN profit_base VARCHAR(20) DEFAULT NULL AFTER profit_method");
    
    echo "Successfully added profit_base column to shipping_costing_sheet_products table.\n";

} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "Column profit_base already exists.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
