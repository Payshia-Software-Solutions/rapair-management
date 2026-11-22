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

// ---- Error handling. Set up BEFORE config.php loads, so a broken config, a missing vendor/ or a
// database that will not connect is still logged and still answered with JSON. Nexus stores the
// "message" of the reply in its provisioning log, so the real cause shows up there.
header('Content-Type: application/json');
ini_set('display_errors', '0'); // never print HTML errors into the JSON reply
ini_set('log_errors', '1');

$PROVISION_LOG = __DIR__ . '/../logs/provision.log';
if (!is_dir(dirname($PROVISION_LOG))) @mkdir(dirname($PROVISION_LOG), 0775, true);
// Not writable (permissions): fall back to the server's PHP error log
if (!is_writable(dirname($PROVISION_LOG))) $PROVISION_LOG = null;

function provision_log($line) {
    global $PROVISION_LOG;
    $entry = '[' . date('Y-m-d H:i:s') . '] ' . $line;
    if (!$PROVISION_LOG || @file_put_contents($PROVISION_LOG, $entry . PHP_EOL, FILE_APPEND | LOCK_EX) === false) {
        error_log('provision: ' . $line);
    }
}

$PROVISION_REPLIED = false;
function provision_reply($code, array $body) {
    global $PROVISION_REPLIED;
    $PROVISION_REPLIED = true;
    provision_log("REPLY $code " . json_encode($body));
    if (!headers_sent()) {
        http_response_code($code);
        header('Content-Type: application/json');
    }
    echo json_encode($body);
    exit;
}

// Warnings and notices go to the log (they often explain a later failure), never to the output
set_error_handler(function ($no, $str, $file, $line) {
    if (!(error_reporting() & $no)) return false;
    provision_log("PHP[$no] $str @ $file:$line");
    return true;
});

// Fatal errors (missing class/file, out of memory, timeout): log and still answer with JSON
register_shutdown_function(function () {
    global $PROVISION_REPLIED;
    $e = error_get_last();
    if (!$e || !in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR], true)) {
        // Something exited without provision_reply (e.g. Env::need on a missing .env setting): log what it sent
        if (!$PROVISION_REPLIED) {
            $out = ob_get_level() > 0 ? (string)ob_get_contents() : '';
            provision_log('EXIT ' . http_response_code() . ' ' . mb_substr($out, 0, 1000));
        }
        return;
    }
    provision_log("FATAL {$e['message']} @ {$e['file']}:{$e['line']}");
    if ($PROVISION_REPLIED) return;
    while (ob_get_level() > 0) ob_end_clean();
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json');
    }
    // File paths stay in the log; the reply carries the message only
    echo json_encode(['status' => 'error', 'message' => 'Workspace server error: ' . $e['message']]);
});
ob_start(); // so a stray warning/echo can be discarded before a fatal-error reply

provision_log('REQUEST ' . ($_SERVER['REQUEST_METHOD'] ?? '-') . ' event=' . ($_SERVER['HTTP_X_NEXUS_EVENT_ID'] ?? '-'));

// BF_CONFIG_PATH: a deployment folder that reuses this code (e.g. a local shared setup) points at its own config
try {
    require_once defined('BF_CONFIG_PATH') ? BF_CONFIG_PATH : __DIR__ . '/../config/config.php';
} catch (Throwable $e) {
    provision_log('CONFIG ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    provision_reply(500, ['status' => 'error', 'message' => 'Workspace server config error: ' . $e->getMessage()]);
}

if (!defined('TENANCY_WEBHOOK_SECRET') || strlen(TENANCY_WEBHOOK_SECRET) < 32 || !class_exists('Tenancy', false)) {
    // Public reply stays a plain 404; the log says which setting is wrong
    provision_log('SETUP ' . (!class_exists('Tenancy', false) ? 'APP_MODE is not shared in .env'
        : (!defined('TENANCY_WEBHOOK_SECRET') ? 'TENANCY_WEBHOOK_SECRET is missing' : 'TENANCY_WEBHOOK_SECRET is shorter than 32 characters')));
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

provision_log("EVENT $type slug=" . ($slug ?: '-') . " event=$eventId");

// Control database (workspace registry). A failure here is a server setup problem: say so plainly.
try {
    require_once APPROOT . '/app/tenancy/Provisioner.php';
    $pdo = TenantRegistry::pdo();

    // Idempotency: an event that already succeeded returns its stored result
    $s = $pdo->prepare("SELECT status, result FROM provision_events WHERE event_id = ?");
    $s->execute([$eventId]);
    $prev = $s->fetch();
} catch (Throwable $e) {
    provision_log('REGISTRY ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    provision_reply(500, ['status' => 'error', 'message' => 'Control database error (check TENANCY_CONTROL_DB_* and run tools/tenants.php init): ' . $e->getMessage()]);
}
if ($prev && $prev['status'] === 'done') {
    provision_reply(200, ['status' => 'success', 'duplicate' => true, 'result' => json_decode((string)$prev['result'], true)]);
}
if (!$prev) {
    // Payload is stored without secrets
    $safe = $data;
    unset($safe['license_key'], $safe['api_key']);
    try {
        $pdo->prepare("INSERT INTO provision_events (event_id, event_type, tenant_slug, payload) VALUES (?, ?, ?, ?)")
            ->execute([$eventId, $type, $slug ?: null, json_encode($safe)]);
    } catch (Throwable $e) {
        provision_log('REGISTRY insert: ' . $e->getMessage());
        provision_reply(500, ['status' => 'error', 'message' => 'Control database error: ' . $e->getMessage()]);
    }
}

ignore_user_abort(true);
set_time_limit(600);

try {
    $p = new Provisioner();
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
    // Log first: if the registry update below also fails, the cause is still on record
    provision_log("ERROR $type $slug: " . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine() . PHP_EOL . $e->getTraceAsString());
    try {
        $pdo->prepare("UPDATE provision_events SET status = 'failed', result = ? WHERE event_id = ?")
            ->execute([json_encode(['error' => $e->getMessage()]), $eventId]);
    } catch (Throwable $x) {
        provision_log('REGISTRY update: ' . $x->getMessage());
    }
    provision_reply($e instanceof InvalidArgumentException ? 400 : 500, ['status' => 'error', 'message' => $e->getMessage()]);
}
