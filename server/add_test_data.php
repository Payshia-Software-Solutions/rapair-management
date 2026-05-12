<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

$db = new Database();

// 1. Add Green Tea to Parts
$db->query("SELECT id FROM parts WHERE part_name = 'Green Tea (Bulk)'");
if (!$db->single()) {
    $db->query("INSERT INTO parts (part_name, price, unit, net_weight_kg, gross_weight_kg, units_per_carton, packing_type, carton_length_cm, carton_width_cm, carton_height_cm, volume_cbm, carton_tare_weight_kg, item_type) VALUES (:name, :price, :unit, :net, :gross, :upc, :ptype, :l, :w, :h, :cbm, :tare, :item_type)");
    $db->bind(':name', 'Green Tea (Bulk)');
    $db->bind(':price', 1500);
    $db->bind(':unit', 'kg');
    $db->bind(':net', 1);
    $db->bind(':gross', 1.01);
    $db->bind(':upc', 25);
    $db->bind(':ptype', 'Sack');
    $db->bind(':l', 50);
    $db->bind(':w', 30);
    $db->bind(':h', 80);
    $db->bind(':cbm', 0.12);
    $db->bind(':tare', 0.25);
    $db->bind(':item_type', 'Part');
    $db->execute();
    echo "Added Green Tea to parts.\n";
}

// 2. Add Paper Sack to Packaging
$db->query("SELECT id FROM export_packaging_types WHERE name = 'Paper Sack (25kg)'");
if (!$db->single()) {
    $db->query("INSERT INTO export_packaging_types (name, type, length_cm, width_cm, height_cm, cbm, tare_weight_kg, max_weight_capacity_kg) VALUES (:name, :type, :l, :w, :h, :cbm, :tare, :max)");
    $db->bind(':name', 'Paper Sack (25kg)');
    $db->bind(':type', 'Bag');
    $db->bind(':l', 50);
    $db->bind(':w', 30);
    $db->bind(':h', 80);
    $db->bind(':cbm', 0.12);
    $db->bind(':tare', 0.25);
    $db->bind(':max', 25);
    $db->execute();
    echo "Added Paper Sack to packaging types.\n";
}
