<?php
/**
 * Sends one signed, harmless test event to a product's provisioning URL and prints the reply.
 * Checks the whole path Nexus uses (firewall, config, vendor/, control database, signature)
 * without creating anything: the event type is unknown, so the product answers 400
 * "Unknown event type" when everything up to that point works.
 *
 *   php scripts/test_provision.php <provision_url> <webhook_secret>
 *   php scripts/test_provision.php https://api-erp.nebulync.com/provision.php "$SECRET"
 *
 * Reading the result:
 *   400 Unknown event type 'nexus.ping'   everything works
 *   401 Bad signature                     secret differs from TENANCY_WEBHOOK_SECRET on the product
 *   404 (JSON) Not found                  product is not APP_MODE=shared, or its secret is under 32 chars
 *   404 (HTML)                            wrong URL
 *   406 / 403 (HTML)                      hosting firewall (ModSecurity / Imunify360) blocked it
 *   500 + message                         the message says what is broken on the product server
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

[$url, $secret] = [$argv[1] ?? '', $argv[2] ?? ''];
if ($url === '' || $secret === '') {
    fwrite(STDERR, "Usage: php scripts/test_provision.php <provision_url> <webhook_secret>\n");
    exit(2);
}

$body = json_encode(['type' => 'nexus.ping', 'data' => ['slug' => 'nexus-ping']]);
$ts = time();
$eventId = 'evt_ping_' . bin2hex(random_bytes(8));
$sig = hash_hmac('sha256', $ts . '.' . $body, $secret);

// Same request as ProvisioningService::deliver()
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_TIMEOUT => 60,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; NexusProvisioner/1.0; +https://nebulync.com)',
    CURLOPT_ENCODING => '',
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Accept: application/json',
        'X-Nexus-Event-Id: ' . $eventId,
        'X-Nexus-Timestamp: ' . $ts,
        'X-Nexus-Signature: ' . $sig,
    ],
]);
$start = microtime(true);
$resp = curl_exec($ch);
$code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = $resp === false ? curl_error($ch) : '';
curl_close($ch);

printf("HTTP %d in %.1fs\n", $code, microtime(true) - $start);
if ($err !== '') { echo "curl error: $err\n"; exit(1); }
$json = json_decode((string)$resp, true);
if (is_array($json)) {
    echo json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    $ok = $code === 400 && stripos((string)($json['message'] ?? ''), 'Unknown event type') !== false;
    echo $ok ? "\nOK: firewall, config, vendor, control database and signature all work.\n" : "\nNot OK: see the reply above.\n";
    exit($ok ? 0 : 1);
}
$title = preg_match('/<title>(.*?)<\/title>/is', (string)$resp, $m) ? trim($m[1]) : '';
echo "Not a JSON reply" . ($title ? ": $title" : '') . "\n";
echo mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags((string)$resp))), 0, 300), "\n";
exit(1);
