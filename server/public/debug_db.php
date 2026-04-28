<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$tables = $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $t) {
    echo "TABLE: $t\n";
    $cols = $db->query("DESCRIBE `$t`")->fetchAll(PDO::FETCH_COLUMN);
    $count = $db->query("SELECT COUNT(*) FROM `$t`")->fetchColumn();
    echo "COUNT: $count\n";
    echo "COLS: " . implode(', ', $cols) . "\n\n";
}
