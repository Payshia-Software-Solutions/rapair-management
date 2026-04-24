<?php
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/core/Database.php';
require_once dirname(__DIR__) . '/app/helpers/OnlineOrderSchema.php';

$db = new Database();
try {
    echo "Creating tables if they don't exist...\n";
    OnlineOrderSchema::ensure();
    echo "Tables ensured.\n";

    // Seed some real test data
    $db->query("SELECT COUNT(*) as count FROM online_orders");
    $count = $db->single()->count;

    if ($count == 0) {
        echo "Seeding initial test orders...\n";
        
        // Order 1
        $orderNo1 = 'WEB-TEST-001';
        $db->query("INSERT INTO online_orders (order_no, customer_details_json, total_amount, payment_method, payment_status, order_status) 
                    VALUES (:no, :details, 15000.00, 'IPG', 'Paid', 'Pending')");
        $db->bind(':no', $orderNo1);
        $db->bind(':details', json_encode(['name' => 'Samantha Perera', 'email' => 'samantha@example.com']));
        $db->execute();
        $id1 = $db->lastInsertId();

        // Order 2
        $orderNo2 = 'WEB-TEST-002';
        $db->query("INSERT INTO online_orders (order_no, customer_details_json, total_amount, payment_method, payment_status, order_status) 
                    VALUES (:no, :details, 7500.00, 'COD', 'Pending', 'Processing')");
        $db->bind(':no', $orderNo2);
        $db->bind(':details', json_encode(['name' => 'Ruwan Kumara', 'email' => 'ruwan@example.com']));
        $db->execute();
        $id2 = $db->lastInsertId();

        echo "Seeded 2 test orders.\n";
    } else {
        echo "Orders table already has data. Skipping seed.\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
