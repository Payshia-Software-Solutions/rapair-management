<?php
$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'saas_master_db';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Add columns if they don't exist
    $pdo->exec("ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS services TEXT AFTER modules");
    $pdo->exec("ALTER TABLE saas_packages ADD COLUMN IF NOT EXISTS server_info VARCHAR(255) AFTER services");
    
    // Update existing packages with some default data
    $packages = [
        ['name' => 'Starter', 'services' => '["Email Support", "Manual Backup"]', 'server_info' => 'Shared Cloud Node'],
        ['name' => 'Pro', 'services' => '["Priority Support", "Automated Daily Backup", "API Access"]', 'server_info' => 'Managed VPS - 4GB RAM'],
        ['name' => 'Ultra', 'services' => '["24/7 Dedicated Support", "Hourly Backups", "Full API Suite", "ERP Integration Bridge"]', 'server_info' => 'Dedicated Infrastructure']
    ];
    
    foreach ($packages as $p) {
        $pdo->prepare("UPDATE saas_packages SET services = ?, server_info = ? WHERE name = ?")
            ->execute([$p['services'], $p['server_info'], $p['name']]);
    }
    
    echo "Database updated successfully: services and server_info columns added/updated.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
