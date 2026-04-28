<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Model.php';
require_once 'server/app/models/Expense.php';
require_once 'server/app/helpers/AccountingHelper.php';
require_once 'server/app/models/Journal.php';
require_once 'server/app/models/AccountMapping.php';
require_once 'server/app/helpers/AccountingSchema.php';

$expense = new Expense();
$data = [
    'expense_account_id' => 1, // dummy
    'payment_account_id' => 2, // dummy
    'amount' => 100.00,
    'payee_name' => 'Test Payee',
    'payment_date' => date('Y-m-d'),
    'payment_method' => 'Cash',
    'notes' => 'Debug test'
];

$res = $expense->create($data);
if ($res) {
    echo "Success! ID: $res\n";
} else {
    echo "Failed to record expense. Check error logs.\n";
}
