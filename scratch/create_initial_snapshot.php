<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/SchemaHelper.php';

$db = new Database();
$h = new SchemaHelper($db);
if ($h->createSnapshot()) {
    echo "Snapshot created successfully.\n";
} else {
    echo "Failed to create snapshot.\n";
}
