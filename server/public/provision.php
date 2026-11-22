<?php
/**
 * Provisioning webhook for the shared (multi-tenant) deployment. Called by Nexus.
 *
 * POST /provision.php
 * Headers:
 *   X-Nexus-Event-Id:  unique id per event (retries reuse it; an event is done once)
 *   X-Nexus-Timestamp: unix seconds (must be within 5 minutes)
 *   X-Nexus-Signature: hex HMAC-SHA256 of "<timestamp>.<raw body>" with TENANCY_WEBHOOK_SECRET
 * Body: {"type": "...", "data": {...}}
 *
 * Events:
 *   tenant.created              data: slug, name, admin_email, [admin_name, plan_code, modules[], license_key, api_key, nexus_tenant_id, domains[]]
 *   subscription.plan_changed   data: slug, plan_code, [modules[], license_key, api_key]
 *   subscription.suspended      data: slug
 *   subscription.resumed        data: slug
 *   tenant.deleted              data: slug          (soft delete; database kept)
 *   workspace.address_changed   data: slug, label   (new public address {label}.<base domain>; old one is dropped)
 *   domain.added / domain.removed  data: slug, domain
 *
 * Not on single-client installs: without tenancy settings in config.php this returns 404.
 */
define('TENANCY_SKIP_BOOT', true); // this endpoint serves no workspace itself
// BF_CONFIG_PATH: a deployment folder that reuses this code (e.g. a local shared setup) points at its own config
require_once defined('BF_CONFIG_PATH') ? BF_CONFIG_PATH : __DIR__ . '/../config/config.php';

header('Content-Type: application/json');

function provision_reply($code, array $body) {
    http_response_code($code);
    echo json_encode($body);
    exit;
}

if (!defined('TENANCY_WEBHOOK_SECRET') || strlen(TENANCY_WEBHOOK_SECRET) < 32 || !class_exists('Tenancy', false)) {
    provision_reply(404, ['status' => 'error', 'message' => 'Not found']);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') provision_reply(405, ['status' => 'error', 'message' => 'POST only']);

$raw = file_get_contents('php://input');
$eventId = trim((string)($_SERVER['HTTP_X_NEXUS_EVENT_ID'] ?? ''));
$ts = (int)($_SERVER['HTTP_X_NEXUS_TIMESTAMP'] ?? 0);
$sig = strtolower(trim((string)($_SERVER['HTTP_X_NEXUS_SIGNATURE'] ?? '')));

if (abs(time() - $ts) > 300) provision_reply(401, ['status' => 'error', 'message' => 'Stale or missing timestamp']);
if (!hash_equals(hash_hmac('sha256', $ts . '.' . $raw, TENANCY_WEBHOOK_SECRET), $sig)) {
    provision_reply(401, ['status' => 'error', 'message' => 'Bad signature']);
}
if (!preg_match('/^[A-Za-z0-9._:-]{8,100}$/', $eventId)) provision_reply(400, ['status' => 'error', 'message' => 'Missing event id']);

$msg = json_decode($raw, true);
$type = (string)($msg['type'] ?? '');
$data = is_array($msg['data'] ?? null) ? $msg['data'] : [];
$slug = strtolower(trim((string)($data['slug'] ?? '')));

require_once APPROOT . '/app/tenancy/Provisioner.php';
$pdo = TenantRegistry::pdo();

// Idempotency: an event that already succeeded returns its stored result
$s = $pdo->prepare("SELECT status, result FROM provision_events WHERE event_id = ?");
$s->execute([$eventId]);
$prev = $s->fetch();
if ($prev && $prev['status'] === 'done') {
    provision_reply(200, ['status' => 'success', 'duplicate' => true, 'result' => json_decode((string)$prev['result'], true)]);
}
if (!$prev) {
    // Payload is stored without secrets
    $safe = $data;
    unset($safe['license_key'], $safe['api_key']);
    $pdo->prepare("INSERT INTO provision_events (event_id, event_type, tenant_slug, payload) VALUES (?, ?, ?, ?)")
        ->execute([$eventId, $type, $slug ?: null, json_encode($safe)]);
}

ignore_user_abort(true);
set_time_limit(600);

$p = new Provisioner();
try {
    switch ($type) {
        case 'tenant.created':
            $result = $p->create($data);
            break;
        case 'subscription.plan_changed':
            $p->changePlan($slug, (string)($data['plan_code'] ?? ''),
                isset($data['modules']) && is_array($data['modules']) ? $data['modules'] : null,
                $data['license_key'] ?? null, $data['api_key'] ?? null);
            $result = ['slug' => $slug];
            break;
        case 'subscription.suspended': $p->suspend($slug); $result = ['slug' => $slug]; break;
        case 'subscription.resumed':   $p->resume($slug);  $result = ['slug' => $slug]; break;
        case 'tenant.deleted':         $p->delete($slug);  $result = ['slug' => $slug]; break;
        case 'workspace.address_changed':
            $result = $p->changeAddress($slug, (string)($data['label'] ?? ''));
            break;
        case 'domain.added':   TenantRegistry::addDomain($slug, (string)($data['domain'] ?? ''), 'custom'); $result = ['slug' => $slug]; break;
        case 'domain.removed': TenantRegistry::removeDomain((string)($data['domain'] ?? '')); $result = ['slug' => $slug]; break;
        default:
            throw new InvalidArgumentException("Unknown event type '$type'");
    }

    // The admin password goes back to Nexus once (to email the client) and is never stored here
    $stored = $result;
    unset($stored['admin_password']);
    $pdo->prepare("UPDATE provision_events SET status = 'done', result = ? WHERE event_id = ?")->execute([json_encode($stored), $eventId]);
    provision_reply(200, ['status' => 'success', 'result' => $result]);
} catch (Throwable $e) {
    $pdo->prepare("UPDATE provision_events SET status = 'failed', result = ? WHERE event_id = ?")
        ->execute([json_encode(['error' => $e->getMessage()]), $eventId]);
    error_log("provision $type $slug: " . $e->getMessage());
    provision_reply($e instanceof InvalidArgumentException ? 400 : 500, ['status' => 'error', 'message' => $e->getMessage()]);
}
