<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';
require_once __DIR__ . '/../app/core/Model.php';
require_once __DIR__ . '/../app/core/Controller.php';
require_once __DIR__ . '/../app/helpers/InventorySchema.php';
require_once __DIR__ . '/../app/models/Invoice.php';
require_once __DIR__ . '/../app/models/Part.php';

$db = new Database();
$invoiceModel = new Invoice();

$partId = 1; // Oil Filter
$qtyToSell = 3; // Should take 2 from BATCH-003 and 1 from BATCH-001

echo "Simulating sale of $qtyToSell units for Part ID: $partId...\n";

// Ensure Part is FIFO enabled
$partModel = new Part();
$db->query("UPDATE parts SET is_fifo = 1, is_expiry = 1 WHERE id = :id");
$db->bind(':id', $partId);
$db->execute();

// Create a dummy invoice
$invoiceData = [
    'invoice_no' => 'TEST-INV-' . time(),
    'customer_id' => 1,
    'location_id' => 1,
    'issue_date' => date('Y-m-d'),
    'due_date' => date('Y-m-d'),
    'subtotal' => 100,
    'tax_total' => 0,
    'discount_total' => 0,
    'grand_total' => 100,
    'userId' => 1,
    'items' => [
        [
            'item_id' => $partId,
            'item_type' => 'Part',
            'description' => 'Oil Filter',
            'quantity' => $qtyToSell,
            'unit_price' => 50,
            'line_total' => 150
        ]
    ]
];

$db->beginTransaction();
try {
    $invoiceId = $invoiceModel->create($invoiceData);
    $invoiceModel->addItems($invoiceId, $invoiceData['items']);
    $db->commit();
    echo "Invoice created: $invoiceId\n";
} catch (Exception $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
    exit;
}

// Verify Batch Stock
echo "\nVerifying Batch Stock after sale:\n";
$db->query("SELECT * FROM inventory_batches WHERE part_id = :pid ORDER BY id ASC");
$db->bind(':pid', $partId);
$batches = $db->resultSet();

foreach ($batches as $b) {
    echo "{$b->batch_number}: {$b->quantity_on_hand} left (Exhausted: {$b->is_exhausted})\n";
}

// Verify Stock Movement
echo "\nVerifying Stock Movements:\n";
$db->query("SELECT * FROM stock_movements WHERE ref_table = 'invoices' AND ref_id = :rid");
$db->bind(':rid', $invoiceId);
$movements = $db->resultSet();

foreach ($movements as $m) {
    echo "Batch ID {$m->batch_id}: Qty Change {$m->qty_change} (Type: {$m->movement_type})\n";
}
