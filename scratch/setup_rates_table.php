<?php
$db = new PDO('mysql:host=localhost;dbname=saas_master_db', 'root', '');
$db->exec("CREATE TABLE IF NOT EXISTS saas_exchange_rates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    currency_code VARCHAR(10) UNIQUE NOT NULL,
    rate DECIMAL(15,6) NOT NULL,
    is_manual TINYINT(1) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

// Seed initial rates if empty
$check = $db->query("SELECT COUNT(*) FROM saas_exchange_rates")->fetchColumn();
if ($check == 0) {
    $db->exec("INSERT INTO saas_exchange_rates (currency_code, rate, is_manual) VALUES 
        ('USD', 1.00, 1),
        ('LKR', 300.00, 0),
        ('EUR', 0.92, 0),
        ('GBP', 0.79, 0)");
}
echo "Table created and seeded successfully";
