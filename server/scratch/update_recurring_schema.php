<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';
require_once __DIR__ . '/../app/helpers/InvoiceSchema.php';
require_once __DIR__ . '/../app/helpers/RecurringInvoiceSchema.php';

echo "Updating Invoice Schema...\n";
InvoiceSchema::ensure(true);
echo "Updating Recurring Invoice Schema...\n";
RecurringInvoiceSchema::ensure(true);
echo "Done!\n";
