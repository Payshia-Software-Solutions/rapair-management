<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$tables = ['invoices', 'invoice_items', 'payment_receipts', 'sales_returns', 'invoice_payments'];
foreach ($tables as $table) {
    echo "--- $table ---\n";
    $res = $db->query("DESCRIBE $table");
    while($row = $res->fetch(PDO::FETCH_ASSOC)) {
        echo "{$row['Field']} - {$row['Type']}\n";
    }
    echo "\n";
}
