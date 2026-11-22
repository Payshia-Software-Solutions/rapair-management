<?php
/**
 * Delivers queued product webhooks (provisioning events) that are due, with retries.
 * Cron, every minute:   * * * * * php /path/to/nexus-portal-server/scripts/deliver_webhooks.php
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../vendor/autoload.php';
spl_autoload_register(function ($class) {
    if (strncmp('App\\', $class, 4) !== 0) return;
    $rel = str_replace('\\', '/', substr($class, 4));
    foreach ([__DIR__ . "/../app/$rel.php", __DIR__ . '/../app/' . strtolower(dirname($rel)) . '/' . basename($rel) . '.php'] as $f) {
        if (is_file($f)) { require $f; return; }
    }
});

// One run at a time
$lock = fopen(sys_get_temp_dir() . '/nexus_deliver_webhooks.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit(0);

[$sent, $notSent] = (new \App\Services\ProvisioningService())->deliverDue(50);
if ($sent || $notSent) echo date('c') . " sent=$sent not_sent=$notSent\n";
