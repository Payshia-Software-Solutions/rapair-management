<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';

$db = new Database();

// 1. Get JSON content
$jsonPath = 'C:\Users\Thilina-Laptop\.gemini\antigravity\brain\d0c359c1-2d02-4e03-90ef-6d104bb82e1c\.system_generated\steps\1109\content.md';
$content = file_get_contents($jsonPath);
// Strip markdown source link
$jsonStart = strpos($content, '{');
$jsonContent = substr($content, $jsonStart);
$data = json_decode($jsonContent, true);

if (!$data) {
    die("Failed to parse JSON\n");
}

echo "Starting massive city import...\n";

// Clear existing cities first to avoid duplicates/mess
$db->query("DELETE FROM cities");
$db->execute();
$db->query("ALTER TABLE cities AUTO_INCREMENT = 1");
$db->execute();

$total = 0;
foreach ($data as $districtName => $districtData) {
    $db->query("SELECT id FROM districts WHERE name = :name");
    
    // Normalize names for matching
    $searchName = $districtName;
    if ($districtName === "Monaragala") $searchName = "Moneragala";
    if ($districtName === "Mullativu") $searchName = "Mullaitivu";
    
    $db->bind(':name', $searchName);
    $district = $db->single();
    
    if (!$district) {
        // Try fuzzy match or skip
        echo "District not found: $districtName\n";
        continue;
    }

    $cities = $districtData['cities'];
    foreach ($cities as $cityName) {
        $db->query("INSERT INTO cities (name, district_id) VALUES (:name, :did)");
        $db->bind(':name', trim($cityName));
        $db->bind(':did', $district->id);
        $db->execute();
        $total++;
    }
}

echo "Imported $total cities across " . count($data) . " districts.\n";
