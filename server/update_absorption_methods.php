<?php
include 'server/config/config.php';
include 'server/app/core/Database.php';
$db = new Database();
try {
    $db->query("ALTER TABLE logistics_factors 
                MODIFY COLUMN absorption_method ENUM('Value','Quantity','Net Weight','Gross Weight','Volume') DEFAULT 'Value'");
    $db->execute();
    echo "Updated absorption_method enum options\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
