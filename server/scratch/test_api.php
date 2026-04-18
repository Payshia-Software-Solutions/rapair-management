<?php
/**
 * Test script to generate a JWT and call the Table List API.
 */
require_once dirname(__DIR__) . '/config/config.php';
require_once dirname(__DIR__) . '/app/helpers/JwtHelper.php';

$secret = JWT_SECRET;
$issuer = JWT_ISSUER;
$ttl = JWT_TTL_SECONDS;

$payload = [
    'iss' => $issuer,
    'sub' => 1, // Admin User ID
    'role' => 'Admin',
    'location_id' => 1,
    'iat' => time(),
    'exp' => time() + $ttl
];

$token = JwtHelper::encode($payload, $secret);

echo "--- AUTH TOKEN ---\n";
echo $token . "\n\n";

echo "--- CALLING ENDPOINT (GET /api/restauranttable/list?location_id=1) ---\n";
$url = "http://localhost/rapair-management/server/public/api/restauranttable/list?location_id=1";

$options = [
    'http' => [
        'method' => 'GET',
        'header' => "Authorization: Bearer $token\r\n" .
                    "X-Location-Id: 1\r\n"
    ]
];

$context = stream_context_create($options);
$response = @file_get_contents($url, false, $context);

if ($response === false) {
    echo "FAILED: " . print_r(error_get_last(), true) . "\n";
} else {
    echo $response . "\n";
}
