<?php
define('APPROOT', dirname(dirname(__DIR__)) . '/server');
require_once APPROOT . '/config/config.php';
require_once APPROOT . '/app/core/Database.php';

$db = new Database();

// 1. Define All Professional Logistics Factors
$allFactors = [
    ['name' => 'Local Transport (Origin)', 'type' => 'Logistic'],
    ['name' => 'Origin Terminal Handling (THC-O)', 'type' => 'Logistic'],
    ['name' => 'Export Customs Clearance', 'type' => 'Clearence'],
    ['name' => 'Export Documentation & BL', 'type' => 'General'],
    ['name' => 'Main Freight (Ocean/Air)', 'type' => 'Freight'],
    ['name' => 'Marine Insurance', 'type' => 'General'],
    ['name' => 'Destination Terminal Handling (THC-D)', 'type' => 'Logistic'],
    ['name' => 'Import Customs Clearance', 'type' => 'Clearence'],
    ['name' => 'Import Duties & Taxes', 'type' => 'Clearence'],
    ['name' => 'Local Delivery (Destination)', 'type' => 'Logistic'],
    ['name' => 'Unloading Charges', 'type' => 'Logistic']
];

foreach ($allFactors as $f) {
    $db->query("INSERT IGNORE INTO logistics_factors (name, type) VALUES (:name, :type)");
    $db->bind(':name', $f['name']);
    $db->bind(':type', $f['type']);
    $db->execute();
}

// 2. Map Factors to IDs
$db->query("SELECT id, name FROM logistics_factors");
$fMap = [];
foreach ($db->resultSet() as $row) {
    $fMap[$row->name] = $row->id;
}

// 3. Define Master Mapping for ALL 11 Incoterms
$masterDefaults = [
    'EXW' => ['Export Documentation & BL'],
    
    'FCA' => ['Local Transport (Origin)', 'Export Customs Clearance', 'Export Documentation & BL'],
    
    'FAS' => ['Local Transport (Origin)', 'Export Customs Clearance', 'Export Documentation & BL'],
    
    'FOB' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Export Documentation & BL'],
    
    'CFR' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Export Documentation & BL'],
    
    'CIF' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Marine Insurance', 'Export Documentation & BL'],
    
    'CPT' => ['Local Transport (Origin)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Export Documentation & BL'],
    
    'CIP' => ['Local Transport (Origin)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Marine Insurance', 'Export Documentation & BL'],
    
    'DAP' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Marine Insurance', 'Destination Terminal Handling (THC-D)', 'Local Delivery (Destination)', 'Export Documentation & BL'],
    
    'DPU' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Marine Insurance', 'Destination Terminal Handling (THC-D)', 'Local Delivery (Destination)', 'Unloading Charges', 'Export Documentation & BL'],
    
    'DDP' => ['Local Transport (Origin)', 'Origin Terminal Handling (THC-O)', 'Export Customs Clearance', 'Main Freight (Ocean/Air)', 'Marine Insurance', 'Destination Terminal Handling (THC-D)', 'Import Customs Clearance', 'Import Duties & Taxes', 'Local Delivery (Destination)', 'Export Documentation & BL']
];

// 4. Clear and Re-seed Defaults
$db->query("DELETE FROM term_factor_defaults");
$db->execute();

foreach ($masterDefaults as $term => $names) {
    foreach ($names as $name) {
        if (isset($fMap[$name])) {
            $db->query("INSERT INTO term_factor_defaults (shipping_term, factor_id) VALUES (:term, :fid)");
            $db->bind(':term', $term);
            $db->bind(':fid', $fMap[$name]);
            $db->execute();
        }
    }
}

echo "Master Logistics Mappings for ALL terms have been successfully defined.\n";
