<?php
try {
    $db = new PDO('mysql:host=localhost;dbname=sc_system', 'root', '');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check if column exists
    $stmt = $db->query("DESCRIBE shipping_costing_sheets");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (!in_array('freight_type', $columns)) {
        $db->exec("ALTER TABLE shipping_costing_sheets ADD COLUMN freight_type VARCHAR(50) DEFAULT NULL AFTER shipping_term");
        echo "Column freight_type added.\n";
    } else {
        echo "Column freight_type already exists.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
