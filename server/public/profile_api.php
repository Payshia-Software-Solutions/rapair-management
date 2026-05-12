<?php
require_once '../config/config.php';
require_once '../app/core/Database.php';

$start = microtime(true);

function mark($label) {
    global $start;
    $now = microtime(true);
    echo sprintf("[%0.4f] %s\n", $now - $start, $label);
}

mark("Starting profiling");

try {
    $db = new Database();
    mark("Database object created");
    
    $db->query("SELECT 1");
    $db->single();
    mark("Simple query executed");
    
    require_once '../app/helpers/InventorySchema.php';
    mark("InventorySchema required");
    
    require_once '../app/helpers/PromotionSchema.php';
    mark("PromotionSchema required");
    
    require_once '../app/helpers/ApiClientsSchema.php';
    mark("ApiClientsSchema required");
    
    require_once '../app/helpers/HotelSchema.php';
    mark("HotelSchema required");
    
    require_once '../app/helpers/SystemSchema.php';
    mark("SystemSchema required");
    
    require_once '../app/helpers/QuotationSchema.php';
    mark("QuotationSchema required");
    
    require_once '../app/helpers/AccountingSchema.php';
    mark("AccountingSchema required");
    
    require_once '../app/helpers/BanquetSchema.php';
    mark("BanquetSchema required");
    
    require_once '../app/helpers/ShippingSchema.php';
    mark("ShippingSchema required");
    
    require_once '../app/helpers/CRMSchema.php';
    mark("CRMSchema required");

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

mark("Finished profiling");
