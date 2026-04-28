<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'repair_management_db');
define('DB_USER', 'root');
define('DB_PASS', '');
require_once 'c:/xampp/htdocs/rapair-management/server/app/core/SchemaDefinition.php';
$s = SchemaDefinition::get();
$targets = ['invoices', 'customers', 'parts'];
foreach ($targets as $t) {
    if (isset($s[$t])) {
        echo "TABLE: $t\n";
        echo "COLS: " . implode(', ', array_keys($s[$t]['columns'])) . "\n\n";
    } else {
        echo "TABLE $t NOT FOUND\n";
    }
}
