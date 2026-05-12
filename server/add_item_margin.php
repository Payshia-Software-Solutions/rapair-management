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
     $pdo->exec("ALTER TABLE shipping_costing_sheet_products ADD COLUMN profit_margin DECIMAL(10,2) DEFAULT 0 AFTER unit_cost");
     echo "Column added successfully!";
} catch (\PDOException $e) {
     echo "Error: " . $e->getMessage();
}
?>
