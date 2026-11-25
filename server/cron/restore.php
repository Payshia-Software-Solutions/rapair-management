<?php
/**
 * Restore a database backup. Command line only. THIS REPLACES THE CURRENT DATA.
 *
 *   php cron/restore.php <backup-file.sql.gz> [workspace-slug] --yes
 *
 * Single install: restores into DB_NAME. Shared install: give the workspace slug.
 * A fresh backup of the current data is taken first (in the same backups folder), so a
 * restore can itself be undone.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$args = array_values(array_filter(array_slice($argv, 1), fn($a) => $a !== '--yes'));
$yes = in_array('--yes', $argv, true);
$file = $args[0] ?? '';
$slug = $args[1] ?? null;
if ($file === '' || !is_file($file)) { fwrite(STDERR, "Usage: php cron/restore.php <backup-file.sql.gz> [workspace-slug] --yes\n"); exit(2); }

define('TENANCY_SKIP_BOOT', true);
require_once __DIR__ . '/../config/config.php';
require_once APPROOT . '/app/helpers/BackupHelper.php';

if (class_exists('Env') && Env::get('APP_MODE', 'single') === 'shared') {
    if (!$slug) { fwrite(STDERR, "Shared mode: give the workspace slug.\n"); exit(2); }
    require_once APPROOT . '/app/tenancy/TenantRegistry.php';
    $t = TenantRegistry::findBySlug($slug);
    if (!$t) { fwrite(STDERR, "Workspace '$slug' not found.\n"); exit(2); }
    $host = $t['db_host'] ?: 'localhost'; $name = $t['db_name']; $user = $t['db_user']; $pass = TenantRegistry::decrypt($t['db_pass_enc']);
    $folder = $slug;
} else {
    $host = DB_HOST; $name = DB_NAME; $user = DB_USER; $pass = DB_PASS; $folder = 'main';
}

if (!$yes) {
    echo "This will REPLACE all data in database '$name' with " . basename($file) . ".\nRun again with --yes to continue.\n";
    exit(1);
}

$pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
echo "Backing up the current data first...\n";
$safety = BackupHelper::create($pdo, $name, $folder);
echo "Saved {$safety['name']}\nRestoring " . basename($file) . "...\n";
$n = BackupHelper::restore($pdo, $file);
echo "Done: $n statements.\n";
