<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

$bankCount = $pdo->query("SELECT COUNT(*) FROM banks")->fetchColumn();
$branchCount = $pdo->query("SELECT COUNT(*) FROM bank_branches")->fetchColumn();

echo "Total Banks: $bankCount\n";
echo "Total Branches: $branchCount\n";

$sample = $pdo->query("SELECT b.name as bank, bb.branch_name as branch FROM banks b JOIN bank_branches bb ON b.id = bb.bank_id LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
print_r($sample);
