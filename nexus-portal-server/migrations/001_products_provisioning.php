<?php
/**
 * Migration 001: products + automatic provisioning (safe to run more than once).
 *
 *   php migrations/001_products_provisioning.php                       uses app/Core/Config.php
 *   php migrations/001_products_provisioning.php --db=name [--host=localhost --user=root --pass=]
 *
 * Adds (never changes or removes existing data):
 *   saas_products            products Nexus sells (BizzFlow ERP, website care, ...) and, for products that
 *                            run workspaces, where to send provisioning webhooks
 *   saas_packages.product_id which product a package belongs to (NULL = none, as today)
 *   saas_tenants.deployment  dedicated (own server/repo, as today) | shared (workspace on the shared deployment)
 *   saas_tenants.provision_status / provision_error / workspace_url
 *   saas_webhook_events      outbox: every event to a product, with retries
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

$hasCol = function ($table, $col) use ($pdo) {
    return (bool)$pdo->query("SHOW COLUMNS FROM `$table` LIKE " . $pdo->quote($col))->fetch();
};
$step = function ($msg) { echo "  - $msg\n"; };

echo "Migrating $db\n";

$pdo->exec("
    CREATE TABLE IF NOT EXISTS saas_products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_key VARCHAR(50) NOT NULL,
        name VARCHAR(150) NOT NULL,
        description VARCHAR(500) NULL,
        provision_url VARCHAR(500) NULL,
        webhook_secret VARCHAR(200) NULL,
        workspace_domain VARCHAR(190) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_product_key (product_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$step('saas_products');

if (!$hasCol('saas_packages', 'product_id')) {
    $pdo->exec("ALTER TABLE saas_packages ADD COLUMN product_id INT NULL AFTER id, ADD KEY idx_pkg_product (product_id)");
    $step('saas_packages.product_id');
}

$tenantCols = [
    'deployment'       => "ENUM('dedicated','shared') NOT NULL DEFAULT 'dedicated'",
    'provision_status' => "ENUM('none','pending','ready','failed') NOT NULL DEFAULT 'none'",
    'provision_error'  => "TEXT NULL",
    'workspace_url'    => "VARCHAR(500) NULL",
];
foreach ($tenantCols as $col => $def) {
    if (!$hasCol('saas_tenants', $col)) {
        $pdo->exec("ALTER TABLE saas_tenants ADD COLUMN `$col` $def");
        $step("saas_tenants.$col");
    }
}

$pdo->exec("
    CREATE TABLE IF NOT EXISTS saas_webhook_events (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_id VARCHAR(64) NOT NULL,
        product_id INT NOT NULL,
        tenant_id INT NULL,
        event_type VARCHAR(60) NOT NULL,
        payload MEDIUMTEXT NOT NULL,
        status ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        next_attempt_at DATETIME NULL,
        last_http_code INT NULL,
        last_error TEXT NULL,
        response MEDIUMTEXT NULL,
        sent_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_whe_event (event_id),
        KEY idx_whe_due (status, next_attempt_at),
        KEY idx_whe_tenant (tenant_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
");
$step('saas_webhook_events');

// The first product. Webhook URL/secret are set later in Admin -> Products.
$pdo->exec("INSERT IGNORE INTO saas_products (product_key, name, description, workspace_domain)
            VALUES ('bizzflow', 'BizzFlow ERP', 'POS, inventory, accounting and more', 'bizzflow.nebulync.com')");
$step('product: bizzflow');

echo "Done.\n";
