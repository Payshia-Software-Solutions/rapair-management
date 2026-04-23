<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();
$db->query("SELECT id, status, amount FROM cheque_inventory LIMIT 5");
$rows = $db->resultSet();

echo "CHEQUE INVENTORY SAMPLE:\n";
foreach ($rows as $row) {
    echo "ID: {$row->id} | STATUS: '{$row->status}' | AMOUNT: '{$row->amount}'\n";
}

$db->query("SELECT id, amount, payment_method FROM payment_receipts LIMIT 5");
$rows = $db->resultSet();

echo "\nPAYMENT RECEIPTS SAMPLE:\n";
foreach ($rows as $row) {
    echo "ID: {$row->id} | METHOD: {$row->payment_method} | AMOUNT: '{$row->amount}'\n";
}
