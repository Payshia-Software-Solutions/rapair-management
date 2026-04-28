<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

echo "--- CAMPAIGNS ---\n";
$db->query("SELECT id, name, status, sent_at FROM email_campaigns ORDER BY id DESC LIMIT 5");
print_r($db->resultSet());

echo "\n--- QUEUE SUMMARY ---\n";
try {
    $db->query("SELECT status, COUNT(*) as count FROM email_queue GROUP BY status");
    print_r($db->resultSet());
} catch(Exception $e) {
    echo "Error checking queue: " . $e->getMessage() . "\n";
}

echo "\n--- LATEST QUEUE ITEMS ---\n";
try {
    $db->query("SELECT id, campaign_id, recipient_email, status FROM email_queue ORDER BY id DESC LIMIT 5");
    print_r($db->resultSet());
} catch(Exception $e) {
    echo "Error checking queue items: " . $e->getMessage() . "\n";
}
