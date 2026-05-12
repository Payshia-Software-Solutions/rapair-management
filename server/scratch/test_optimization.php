<?php
require_once 'app/core/Database.php';
require_once 'app/core/SchemaHelper.php';
require_once 'config/config.php';

$db = new Database();
$helper = new SchemaHelper($db);

echo "Checking for missing indexes...\n";
$diff = $helper->getDiff();
if (empty($diff['missing_indexes'])) {
    echo "No missing indexes found. Database is already optimized.\n";
} else {
    echo "Found " . count($diff['missing_indexes']) . " missing indexes.\n";
    foreach ($diff['missing_indexes'] as $idx) {
        echo " - {$idx['table']}.{$idx['index']}\n";
    }
    
    echo "\nApplying optimizations...\n";
    $results = $helper->sync(['missing_tables' => [], 'missing_columns' => [], 'missing_indexes' => $diff['missing_indexes']]);
    foreach ($results as $res) {
        echo " [OK] $res\n";
    }
}
