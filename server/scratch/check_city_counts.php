<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

$db->query("SELECT COUNT(*) as count FROM cities");
$res = $db->single();
echo "Total Cities: " . $res->count . "\n\n";

$db->query("SELECT d.id, d.name, (SELECT COUNT(*) FROM cities WHERE district_id = d.id) as city_count FROM districts d");
$rows = $db->resultSet();

foreach ($rows as $r) {
    echo $r->name . " (ID: " . $r->id . "): " . $r->city_count . "\n";
}
