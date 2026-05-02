<?php
define('APPROOT', __DIR__ . '/app');
require_once 'config/config.php';
require_once 'app/core/Database.php';
require_once 'app/core/Model.php';
require_once 'app/models/ShippingCostingSheet.php';

$payload = json_decode('{
    "template_id": "",
    "customer_id": "1",
    "reference_number": "REF-TEST-001",
    "status": "Draft",
    "items": [
        {
            "name": "Local Transport to Port",
            "cost_type": "Manual",
            "value": 0,
            "calculated_amount": 0,
            "absorption_method": "Value"
        },
        {
            "name": "Origin Terminal Handling",
            "cost_type": "Manual",
            "value": 0,
            "calculated_amount": 0,
            "absorption_method": "Value"
        },
        {
            "name": "Export Customs Clearance",
            "cost_type": "Manual",
            "value": 0,
            "calculated_amount": 0,
            "absorption_method": "Value"
        }
    ],
    "cost_components": [],
    "manual_costs": [
        {
            "name": "Local Transport to Port",
            "amount": 0,
            "absorption_method": "Value"
        },
        {
            "name": "Origin Terminal Handling",
            "amount": 0,
            "absorption_method": "Value"
        },
        {
            "name": "Export Customs Clearance",
            "amount": 0,
            "absorption_method": "Value"
        }
    ],
    "shipping_term": "FOB",
    "freight_type": "Sea Freight",
    "shipment_mode": "LCL",
    "profit_method": "Markup",
    "profit_margin_percent": 10,
    "other_costs": 0,
    "overhead_absorption_method": "Value",
    "target_currency": "USD",
    "exchange_rate": 300,
    "profit_value": 10,
    "total_cost": 412500,
    "total_quantity": 250,
    "base_carrier_cost": 375000,
    "product_items": [
        {
            "part_id": "1",
            "name": "Green Tea (Bulk)",
            "quantity": 250,
            "unit_cost": 1500,
            "line_total": 375000,
            "weight": 1,
            "cbm": 0.0048,
            "profit_margin": 0,
            "packing_type": "Carton",
            "unit": "kg",
            "units_per_carton": 25,
            "carton_length": 50,
            "carton_width": 30,
            "carton_height": 80,
            "volume_cbm": 0.12,
            "carton_tare_weight": 0.25,
            "net_weight": 0,
            "gross_weight": 0,
            "packaging_type_id": "none"
        }
    ]
}', true);

// Override part_id to 1 as we know it exists
$payload['product_items'][0]['part_id'] = 1;

$model = new ShippingCostingSheet();
$id = $model->create($payload, 1);

if ($id) {
    echo "SUCCESS! Created Sheet ID: " . $id . "\n";
    
    // Verify items
    $sheet = $model->getById($id);
    echo "Items Count: " . count($sheet->items) . "\n";
    echo "Products Count: " . count($sheet->product_items) . "\n";
    echo "Currency: " . $sheet->target_currency . "\n";
    echo "Exchange Rate: " . $sheet->exchange_rate . "\n";
} else {
    echo "FAILED! Check logs.\n";
}
