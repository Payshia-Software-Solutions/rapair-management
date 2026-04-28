<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$pdo = $db->getDb();

$banksUrl = 'https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List/raw/refs/heads/master/banks.json';
$branchesUrl = 'https://github.com/samma89/Sri-Lanka-Bank-and-Branch-List/raw/refs/heads/master/branches.json';

echo "Fetching banks...\n";
$banksJson = file_get_contents($banksUrl);
$banks = json_decode($banksJson, true);

echo "Fetching branches...\n";
$branchesJson = file_get_contents($branchesUrl);
$branchesByBank = json_decode($branchesJson, true);

if (!$banks || !$branchesByBank) {
    die("Failed to fetch or decode JSON data.\n");
}

echo "Processing " . count($banks) . " banks...\n";

foreach ($banks as $bankData) {
    $bankIdInJson = $bankData['ID'];
    $bankName = $bankData['name'];
    
    // Check if bank exists (by name or code)
    $stmt = $pdo->prepare("SELECT id FROM banks WHERE name = ? OR code = ?");
    $stmt->execute([$bankName, (string)$bankIdInJson]);
    $existingBank = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingBank) {
        $bankDbId = $existingBank['id'];
        // Update code if missing
        $pdo->prepare("UPDATE banks SET code = ? WHERE id = ?")->execute([(string)$bankIdInJson, $bankDbId]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO banks (name, code) VALUES (?, ?)");
        $stmt->execute([$bankName, (string)$bankIdInJson]);
        $bankDbId = $pdo->lastInsertId();
    }
    
    echo "Importing branches for {$bankName} (ID: {$bankDbId})...\n";
    
    if (isset($branchesByBank[(string)$bankIdInJson])) {
        $branchList = $branchesByBank[(string)$bankIdInJson];
        foreach ($branchList as $branchData) {
            $branchName = $branchData['name'];
            $branchCode = (string)$branchData['ID'];
            
            // Pad branch code to 3 digits if needed
            $branchCode = str_pad($branchCode, 3, '0', STR_PAD_LEFT);
            
            // Check if branch exists for this bank
            $stmt = $pdo->prepare("SELECT id FROM bank_branches WHERE bank_id = ? AND (branch_name = ? OR branch_code = ?)");
            $stmt->execute([$bankDbId, $branchName, $branchCode]);
            if (!$stmt->fetch()) {
                $stmt = $pdo->prepare("INSERT INTO bank_branches (bank_id, branch_name, branch_code) VALUES (?, ?, ?)");
                $stmt->execute([$bankDbId, $branchName, $branchCode]);
            }
        }
    }
}

echo "Import completed successfully.\n";
