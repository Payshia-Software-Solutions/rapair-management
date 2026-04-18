<?php
/**
 * Test script to generate an invoice with table_id and steward_id.
 */
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/helpers/JwtHelper.php';

$secret = JWT_SECRET;
$payload = [
    'iss' => JWT_ISSUER,
    'sub' => 1,
    'role' => 'Admin',
    'location_id' => 1,
    'iat' => time(),
    'exp' => time() + 3600,
    'allowed_location_ids' => [1]
];
$token = JwtHelper::encode($payload, $secret);

echo "--- CREATING TEST INVOICE WITH TABLE ---\n";
$url = "http://localhost/rapair-management/server/public/api/invoice/create";

$payload = [
    'customer_id' => 1,
    'location_id' => 1,
    'issue_date' => date('Y-m-d'),
    'subtotal' => 1000,
    'tax_total' => 0,
    'grand_total' => 1000,
    'order_type' => 'dine_in',
    'table_id' => 1, // <--- VERIFYING STORAGE
    'steward_id' => 1, // <--- VERIFYING STORAGE
    'items' => [
        [
            'description' => 'Test Table Item',
            'item_type' => 'Service',
            'quantity' => 1,
            'unit_price' => 1000,
            'line_total' => 1000
        ]
    ]
];

$options = [
    'http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n" .
                    "Authorization: Bearer $token\r\n",
        'content' => json_encode($payload)
    ]
];

$context = stream_context_create($options);
$response = file_get_contents($url, false, $context);
echo $response . "\n\n";

echo "--- VERIFYING IN DATABASE ---\n";
// No command execution here, I'll just run mysql command separately after this.
