<?php
/**
 * Nightly database backup. Run from cron, never from the web:
 *
 *   php /path/to/server/cron/backup.php            all databases
 *   php /path/to/server/cron/backup.php acme       one workspace (shared mode)
 *
 * Example crontab (02:00 every night):
 *   0 2 * * * /usr/bin/php /home/USER/server/cron/backup.php >> /home/USER/server/logs/backup.log 2>&1
 *
 * Single install: backs up DB_NAME into storage/backups/main/.
 * Shared install: backs up every active workspace into storage/backups/<slug>/ and the
 * control database into storage/backups/_control/.
 * Exit code 1 when any backup failed, so cron mail / monitoring notices.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

define('TENANCY_SKIP_BOOT', true); // shared mode: don't pick a workspace, we walk all of them
require_once __DIR__ . '/../config/config.php';
require_once APPROOT . '/app/helpers/BackupHelper.php';

$only = $argv[1] ?? null;
$failed = 0;
$log = function ($msg) { echo '[' . date('Y-m-d H:i:s') . "] $msg\n"; };
$connect = function ($host, $name, $user, $pass) {
    return new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
};
$run = function ($label, $folder, $host, $name, $user, $pass) use ($connect, $log, &$failed) {
    try {
        $r = BackupHelper::create($connect($host, $name, $user, $pass), $name, $folder);
        $log(sprintf('OK   %-24s %s  %.1f MB, %d tables, %d rows%s', $label, $r['name'], $r['size'] / 1048576, $r['tables'], $r['rows'],
            $r['offsite'] ? "  off-site: {$r['offsite']}" : ''));
        if (is_string($r['offsite']) && strpos($r['offsite'], 'failed') === 0) $failed++;
    } catch (Throwable $e) {
        $failed++;
        $log("FAIL $label: " . $e->getMessage());
    }
};

if (class_exists('Env') && Env::get('APP_MODE', 'single') === 'shared') {
    require_once APPROOT . '/app/tenancy/TenantRegistry.php';
    if (!$only) $run('control database', '_control', TENANCY_CONTROL_DB_HOST, TENANCY_CONTROL_DB_NAME, TENANCY_CONTROL_DB_USER, TENANCY_CONTROL_DB_PASS);
    foreach (TenantRegistry::all() as $t) {
        if ($only && $t['slug'] !== $only) continue;
        if ($t['status'] === 'deleted' || empty($t['db_name'])) continue;
        $pass = TenantRegistry::decrypt($t['db_pass_enc']);
        if ($pass === null) { $failed++; $log("FAIL {$t['slug']}: cannot read its database password"); continue; }
        $run($t['slug'], $t['slug'], $t['db_host'] ?: 'localhost', $t['db_name'], $t['db_user'], $pass);
    }
} else {
    $run(DB_NAME, 'main', DB_HOST, DB_NAME, DB_USER, DB_PASS);
}

exit($failed ? 1 : 0);
