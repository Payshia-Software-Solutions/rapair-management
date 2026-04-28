<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();

$db->query("SELECT id, name, status FROM email_campaigns ORDER BY id DESC LIMIT 20");
$camps = $db->resultSet();

foreach ($camps as $c) {
    echo "ID: {$c->id} | Status: '{$c->status}' | Name: {$c->name}\n";
}
