<?php
// Test Admin Access via Command Line
$baseUrl = 'http://localhost/rapair-management/server';

function call($path, $method = 'GET', $data = null, $token = null) {
    global $baseUrl;
    $ch = curl_init($baseUrl . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    $headers = ['Content-Type: application/json'];
    if ($token) $headers[] = "Authorization: Bearer $token";
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
    
    $res = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    
    return [
        'status' => $info['http_code'],
        'body' => json_decode($res, true) ?: $res
    ];
}

echo "1. Attempting login as admin@local...\n";
$login = call('/api/auth/login', 'POST', [
    'email' => 'admin@local',
    'password' => 'admin123'
]);

if ($login['status'] !== 200) {
    echo "Login Failed (HTTP {$login['status']}):\n";
    print_r($login['body']);
    exit(1);
}

$token = $login['body']['data']['token'] ?? null;
echo "Login Success. Role in Token: " . ($login['body']['data']['user']['role'] ?? 'unknown') . "\n";

echo "\n2. Calling /api/location/list (Checking Permission Fix)...\n";
$locs = call('/api/location/list', 'GET', null, $token);

echo "HTTP Status: {$locs['status']}\n";
if ($locs['status'] === 200) {
    echo "SUCCESS: Admin successfully bypassed permissions.\n";
    echo "Location Count: " . count($locs['body']['data'] ?? []) . "\n";
    foreach (($locs['body']['data'] ?? []) as $l) {
        echo " - ID: {$l['id']}, Name: {$l['name']}\n";
    }
} else {
    echo "FAILED: Permission error still persists.\n";
    print_r($locs['body']);
}
