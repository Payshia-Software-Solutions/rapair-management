<?php
$host = 'localhost';
$user = 'root';
$pass = '';
$db = 'saas_master_db';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Add api_key column if it doesn't exist
    $pdo->exec("ALTER TABLE saas_tenants ADD COLUMN IF NOT EXISTS api_key VARCHAR(255) AFTER license_key");
    
    // Populate existing rows with a random API key
    $stmt = $pdo->query("SELECT id FROM saas_tenants WHERE api_key IS NULL OR api_key = ''");
    while ($row = $stmt->fetch()) {
        $apiKey = 'NX-' . bin2hex(random_bytes(16));
        $pdo->prepare("UPDATE saas_tenants SET api_key = ? WHERE id = ?")->execute([$apiKey, $row['id']]);
    }
    
    echo "Database updated successfully: api_key column added and populated.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
