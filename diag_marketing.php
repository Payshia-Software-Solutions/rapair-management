<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

$db->query("SELECT id, name, status FROM email_campaigns WHERE status IN ('Queued', 'Processing')");
$camps = $db->resultSet();

echo "--- ACTIVE CAMPAIGNS ---\n";
foreach ($camps as $c) {
    $db->query("SELECT COUNT(*) as total FROM email_queue WHERE campaign_id = :id");
    $db->bind(':id', $c->id);
    $total = $db->single()->total;

    $db->query("SELECT COUNT(*) as pending FROM email_queue WHERE campaign_id = :id AND status IN ('Pending', 'Processing')");
    $db->bind(':id', $c->id);
    $pending = $db->single()->pending;

    echo "Campaign [{$c->id}] {$c->name}: Status={$c->status}, Total Queue={$total}, Pending Queue={$pending}\n";
}
