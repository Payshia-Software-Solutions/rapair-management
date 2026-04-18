<?php
require_once 'app/core/Database.php';
require_once 'app/models/PaymentReceipt.php';

if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');
if (!defined('DB_NAME')) define('DB_NAME', 'repair_management_db');

$db = new Database();
$receiptModel = new PaymentReceipt();

echo "Checking for missing Payment Receipts (manual payments)...\n";

$db->query("
    SELECT ip.*, i.invoice_no, i.customer_id, c.name as customer_name, i.location_id
    FROM invoice_payments ip
    JOIN invoices i ON ip.invoice_id = i.id
    JOIN customers c ON i.customer_id = c.id
    LEFT JOIN payment_receipts pr ON ip.invoice_id = pr.invoice_id AND ABS(ip.amount - pr.amount) < 0.01
    WHERE DATE(ip.created_at) = CURDATE() AND pr.id IS NULL
");
$missing = $db->resultSet();

echo "Found " . count($missing) . " missing receipts.\n";

foreach ($missing as $m) {
    echo "Creating receipt for Invoice $m->invoice_no (LKR $m->amount)...\n";
    $receiptData = [
        'invoice_id' => $m->invoice_id,
        'invoice_no' => $m->invoice_no,
        'customer_id' => $m->customer_id,
        'customer_name' => $m->customer_name,
        'location_id' => $m->location_id,
        'amount' => $m->amount,
        'payment_method' => $m->payment_method ?: 'Cash',
        'payment_date' => $m->payment_date,
        'reference_no' => $m->reference_no,
        'notes' => $m->notes,
        'created_by' => $m->created_by
    ];
    $res = $receiptModel->create($receiptData);
    if ($res) {
        echo "Created: $res\n";
    } else {
        echo "Failed to create receipt.\n";
    }
}

echo "All missing receipts processed.\n";
