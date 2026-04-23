<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

echo "--- DATE INFO ---\n";
$db->query("SELECT CURDATE() as d");
echo "MySQL CURDATE: " . $db->single()->d . "\n";
echo "PHP DATE: " . date('Y-m-d') . "\n";

echo "\n--- INVOICES COUNT ---\n";
$db->query("SELECT COUNT(*) as cnt FROM invoices");
echo "Total Invoices: " . $db->single()->cnt . "\n";

echo "\n--- TODAY'S REVENUE ---\n";
$db->query("SELECT SUM(grand_total) as total FROM invoices WHERE issue_date = CURDATE() AND status <> 'Cancelled'");
echo "Today's Revenue: " . ($db->single()->total ?? 0) . "\n";

echo "\n--- MTD REVENUE ---\n";
$db->query("SELECT SUM(grand_total) as total FROM invoices WHERE issue_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND status <> 'Cancelled'");
echo "MTD Revenue: " . ($db->single()->total ?? 0) . "\n";

echo "\n--- RECENT INVOICES ---\n";
$db->query("SELECT id, invoice_no, issue_date, grand_total, status, location_id FROM invoices ORDER BY id DESC LIMIT 5");
$rows = $db->resultSet();
foreach ($rows as $r) {
    echo "ID: {$r->id} | No: {$r->invoice_no} | Date: {$r->issue_date} | Total: {$r->grand_total} | Status: {$r->status} | Loc: {$r->location_id}\n";
}

echo "\n--- SERVICE LOCATIONS ---\n";
$db->query("SELECT id, name FROM service_locations");
foreach ($db->resultSet() as $loc) {
    echo "ID: {$loc->id} | Name: {$loc->name}\n";
}
