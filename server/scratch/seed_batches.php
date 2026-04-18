<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$partId = 1; // Oil Filter
$locationId = 1;

echo "Seeding test batches for part $partId at location $locationId...\n";

// Clear existing test batches (optional)
$db->query("DELETE FROM inventory_batches WHERE part_id = :pid");
$db->bind(':pid', $partId);
$db->execute();

$batches = [
    [
        'batch_number' => 'BATCH-001',
        'mfg_date' => '2024-01-01',
        'expiry_date' => '2025-01-01',
        'qty' => 5
    ],
    [
        'batch_number' => 'BATCH-002',
        'mfg_date' => '2024-01-15',
        'expiry_date' => '2025-01-15',
        'qty' => 10
    ],
    [
        'batch_number' => 'BATCH-003',
        'mfg_date' => '2023-12-01', // Oldest
        'expiry_date' => '2024-12-01',
        'qty' => 2
    ]
];

foreach ($batches as $b) {
    echo "Inserting {$b['batch_number']}...\n";
    $db->query("
        INSERT INTO inventory_batches (
            part_id, location_id, batch_number, mfg_date, expiry_date, 
            quantity_on_hand, is_exhausted, created_at
        ) VALUES (
            :pid, :loc, :bn, :mfg, :exp, :qty, 0, NOW()
        )
    ");
    $db->bind(':pid', $partId);
    $db->bind(':loc', $locationId);
    $db->bind(':bn', $b['batch_number']);
    $db->bind(':mfg', $b['mfg_date']);
    $db->bind(':exp', $b['expiry_date']);
    $db->bind(':qty', $b['qty']);
    $db->execute();
}

echo "Seeding complete.\n";
