<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "TABLE: acc_supplier_payments\n";
    $stmt = $pdo->query("SELECT count(*) FROM acc_supplier_payments");
    echo "Count: " . $stmt->fetchColumn() . "\n";
    
    echo "TABLE: suppliers\n";
    $stmt = $pdo->query("SELECT count(*) FROM suppliers");
    echo "Count: " . $stmt->fetchColumn() . "\n";
    
    echo "\nCOLUMNS:\n";
    $stmt = $pdo->query("DESCRIBE acc_supplier_payments");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo $row['Field'] . " - " . $row['Type'] . "\n";
    }
    
    echo "\nRECENT DATA:\n";
    $stmt = $pdo->query("SELECT * FROM acc_supplier_payments ORDER BY id DESC LIMIT 5");
    while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        print_r($row);
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage();
}
