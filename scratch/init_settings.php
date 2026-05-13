<?php
$db = new PDO('mysql:host=localhost;dbname=saas_master_db', 'root', '');
$db->exec("CREATE TABLE IF NOT EXISTS saas_settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

// Set default exchange rate source
$db->exec("INSERT IGNORE INTO saas_settings (setting_key, setting_value) VALUES ('exchange_rate_source', 'exchangerate-api')");
echo "Settings table initialized";
