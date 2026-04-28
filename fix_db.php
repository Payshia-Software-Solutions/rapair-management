<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

echo "Altering table...\n";
try {
    $res = $pdo->exec("ALTER TABLE email_campaigns MODIFY COLUMN status ENUM('Draft', 'Queued', 'Processing', 'Sent', 'Failed') DEFAULT 'Draft'");
    echo "Alter result: " . var_export($res, true) . "\n";
} catch(Exception $e) {
    echo "Alter error: " . $e->getMessage() . "\n";
}

echo "Updating empty statuses...\n";
try {
    $res = $pdo->exec("UPDATE email_campaigns SET status = 'Queued' WHERE status = '' OR status IS NULL");
    echo "Update result: " . var_export($res, true) . "\n";
} catch(Exception $e) {
    echo "Update error: " . $e->getMessage() . "\n";
}

echo "Verifying...\n";
$db->query("DESCRIBE email_campaigns");
print_r($db->resultSet());
