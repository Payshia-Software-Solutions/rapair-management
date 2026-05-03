<?php
require_once 'server/config/config.php';
require_once 'server/app/helpers/RecurringInvoiceSchema.php';

try {
    RecurringInvoiceSchema::ensure(true);
    echo "Schema updated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
