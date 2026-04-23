<?php
/**
 * Migration: Create saas_invoices table in master DB
 */
$host = 'localhost';
$user = 'root';
$pass = '';
$dbName = 'saas_master_db';

try {
    $pdo = new PDO("mysql:host=$host", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Create DB if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS $dbName");
    $pdo->exec("USE $dbName");
    
    // Create saas_invoices table
    $sql = "CREATE TABLE IF NOT EXISTS saas_invoices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tenant_id INT NOT NULL,
        invoice_number VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status ENUM('Paid', 'Pending', 'Overdue') DEFAULT 'Pending',
        due_date DATE NOT NULL,
        paid_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id) ON DELETE CASCADE
    )";
    
    $pdo->exec($sql);
    echo "Table saas_invoices created successfully.\n";

    // Seed some test data for current tenants
    $stmt = $pdo->query("SELECT id FROM saas_tenants LIMIT 5");
    $tenants = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($tenants as $t) {
        $tid = $t['id'];
        $pdo->exec("INSERT INTO saas_invoices (tenant_id, invoice_number, amount, status, due_date) 
                   VALUES ($tid, 'INV-".rand(1000,9999)."', ".rand(49, 199).".00, 'Paid', '".date('Y-m-d', strtotime('-30 days'))."')");
        $pdo->exec("INSERT INTO saas_invoices (tenant_id, invoice_number, amount, status, due_date) 
                   VALUES ($tid, 'INV-".rand(1000,9999)."', ".rand(49, 199).".00, 'Pending', '".date('Y-m-d', strtotime('+5 days'))."')");
    }
    echo "Seed data added successfully.\n";

} catch (PDOException $e) {
    die("DB Error: " . $e->getMessage());
}
