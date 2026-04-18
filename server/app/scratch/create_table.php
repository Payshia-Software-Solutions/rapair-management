<?php
require_once 'c:\xampp\htdocs\rapair-management\server\config\config.php';

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Creating inventory_batches table...\n";
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_batches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            part_id INT NOT NULL,
            location_id INT NOT NULL DEFAULT 1,
            batch_number VARCHAR(100) NULL,
            mfg_date DATE NULL,
            expiry_date DATE NULL,
            quantity_received DECIMAL(12,3) NOT NULL DEFAULT 0.000,
            quantity_on_hand DECIMAL(12,3) NOT NULL DEFAULT 0.000,
            unit_cost DECIMAL(15,4) NULL,
            grn_id INT NULL,
            is_exhausted TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ib_part (part_id),
            INDEX idx_ib_location (location_id),
            INDEX idx_ib_mfg (mfg_date),
            INDEX idx_ib_expiry (expiry_date),
            INDEX idx_ib_exhausted (is_exhausted),
            FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE,
            FOREIGN KEY (location_id) REFERENCES service_locations(id)
        ) ENGINE=InnoDB
    ");
    echo "Done.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
