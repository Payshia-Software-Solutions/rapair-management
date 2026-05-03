<?php
$db = new PDO('mysql:host=localhost;dbname=saas_master_db', 'root', '');

// 1. Create saas_payments table
$db->exec("CREATE TABLE IF NOT EXISTS saas_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    receipt_number VARCHAR(20) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'Bank Transfer',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES saas_invoices(id) ON DELETE CASCADE
)");

// 2. Add Company Settings to saas_settings
$settings = [
    'company_name' => 'Nebulink Systems (Pvt) Ltd',
    'company_address' => "Tech Plaza, Suite 402, Level 04\nColombo 04, Sri Lanka",
    'company_email' => 'billing@nebulink.com',
    'company_phone' => '+94 11 234 5678',
    'company_website' => 'www.nebulink.com',
    'company_logo' => 'nebulink-logo-croped.png'
];

foreach ($settings as $key => $val) {
    $stmt = $db->prepare("INSERT IGNORE INTO saas_settings (setting_key, setting_value) VALUES (?, ?)");
    $stmt->execute([$key, $val]);
}

echo "Database updated for Payments and Company Settings";
