<?php
/**
 * Migration 002: developer mode per tenant (safe to run more than once).
 *
 *   php migrations/002_dev_mode.php                       uses app/Core/Config.php
 *   php migrations/002_dev_mode.php --db=name [--host=localhost --user=root --pass=]
 *
 * Adds saas_tenants.dev_mode (0/1). When on, the workspace shows its Developer Options menu.
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$opts = [];
foreach (array_slice($argv, 1) as $a) if (preg_match('/^--([a-z]+)=(.*)$/', $a, $m)) $opts[$m[1]] = $m[2];

if (isset($opts['db'])) {
    $host = $opts['host'] ?? 'localhost'; $user = $opts['user'] ?? 'root'; $pass = $opts['pass'] ?? ''; $db = $opts['db'];
} else {
    $cfg = __DIR__ . '/../app/Core/Config.php';
    if (!is_file($cfg)) { fwrite(STDERR, "app/Core/Config.php not found; pass --db=... (and --host/--user/--pass)\n"); exit(1); }
    require $cfg;
    $host = \App\Core\Config::DB_HOST(); $user = \App\Core\Config::DB_USER(); $pass = \App\Core\Config::DB_PASS(); $db = \App\Core\Config::DB_NAME();
}

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

echo "Migrating $db\n";
if (!$pdo->query("SHOW COLUMNS FROM saas_tenants LIKE 'dev_mode'")->fetch()) {
    $pdo->exec("ALTER TABLE saas_tenants ADD COLUMN dev_mode TINYINT(1) NOT NULL DEFAULT 0");
    echo "  - saas_tenants.dev_mode\n";
}
echo "Done\n";
