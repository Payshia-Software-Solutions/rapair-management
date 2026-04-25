<?php
try {
    $db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $queries = [
        "ALTER TABLE invoices ADD INDEX idx_inv_location (location_id)",
        "ALTER TABLE payment_receipts ADD INDEX idx_pr_location (location_id)",
        "ALTER TABLE sales_returns ADD INDEX idx_sr_location (location_id)"
    ];

    foreach ($queries as $sql) {
        try {
            echo "Executing: $sql\n";
            $db->exec($sql);
            echo "Success!\n";
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Duplicate key name') !== false) {
                echo "Index already exists. Skipping.\n";
            } else {
                echo "Error: " . $e->getMessage() . "\n";
            }
        }
    }
} catch (PDOException $e) {
    echo "Connection Error: " . $e->getMessage() . "\n";
}
