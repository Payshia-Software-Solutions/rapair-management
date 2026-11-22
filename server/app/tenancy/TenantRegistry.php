<?php
/**
 * TenantRegistry
 * The control database for the shared (multi-tenant) deployment: which tenants exist,
 * their domains, their database credentials and their plan modules.
 *
 * Filled by Nexus provisioning webhooks (public/provision.php) or the CLI (tools/tenants.php).
 * The app reads it on every request, so clients keep working even when Nexus is down.
 *
 * Only used when the deployment's config.php enables tenancy (see config/config.example.php, APP_MODE=shared).
 * Single-client installs never touch it.
 */
class TenantRegistry {
    private static $pdo = null;

    public static function pdo() {
        if (self::$pdo) return self::$pdo;
        self::$pdo = new PDO(
            'mysql:host=' . TENANCY_CONTROL_DB_HOST . ';dbname=' . TENANCY_CONTROL_DB_NAME . ';charset=utf8mb4',
            TENANCY_CONTROL_DB_USER,
            TENANCY_CONTROL_DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_TIMEOUT => 5]
        );
        return self::$pdo;
    }

    /** Creates the control tables. Run from the CLI (tools/tenants.php init), not per request. */
    public static function ensureSchema() {
        $pdo = self::pdo();
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tenants (
                id INT AUTO_INCREMENT PRIMARY KEY,
                slug VARCHAR(63) NOT NULL,
                name VARCHAR(190) NOT NULL,
                status ENUM('provisioning','active','suspended','failed','deleted') NOT NULL DEFAULT 'provisioning',
                db_host VARCHAR(190) NOT NULL DEFAULT 'localhost',
                db_name VARCHAR(64) NULL,
                db_user VARCHAR(64) NULL,
                db_pass_enc TEXT NULL,
                license_key VARCHAR(190) NULL,
                api_key VARCHAR(190) NULL,
                plan_code VARCHAR(100) NULL,
                modules_json TEXT NULL,
                nexus_tenant_id VARCHAR(100) NULL,
                admin_email VARCHAR(190) NULL,
                provision_step VARCHAR(50) NULL,
                last_error TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_tenant_slug (slug),
                KEY idx_tenant_nexus (nexus_tenant_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS tenant_domains (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL,
                domain VARCHAR(253) NOT NULL,
                kind ENUM('app','api','custom') NOT NULL DEFAULT 'app',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uq_domain (domain),
                KEY idx_domain_tenant (tenant_id),
                CONSTRAINT fk_domain_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
        // One row per Nexus webhook delivery: makes retries safe (same event_id is done once)
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS provision_events (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event_id VARCHAR(100) NOT NULL,
                event_type VARCHAR(60) NOT NULL,
                tenant_slug VARCHAR(63) NULL,
                payload MEDIUMTEXT NULL,
                status ENUM('received','done','failed') NOT NULL DEFAULT 'received',
                result TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_event (event_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");
    }

    public static function findBySlug($slug) {
        $s = self::pdo()->prepare("SELECT * FROM tenants WHERE slug = ? LIMIT 1");
        $s->execute([$slug]);
        return $s->fetch() ?: null;
    }

    public static function findByDomain($domain) {
        $s = self::pdo()->prepare("SELECT t.* FROM tenant_domains d INNER JOIN tenants t ON t.id = d.tenant_id WHERE d.domain = ? LIMIT 1");
        $s->execute([strtolower($domain)]);
        return $s->fetch() ?: null;
    }

    public static function all($includeDeleted = false) {
        $sql = "SELECT t.*, (SELECT GROUP_CONCAT(domain ORDER BY id SEPARATOR ', ') FROM tenant_domains d WHERE d.tenant_id = t.id) AS domains
                FROM tenants t" . ($includeDeleted ? "" : " WHERE t.status <> 'deleted'") . " ORDER BY t.slug";
        return self::pdo()->query($sql)->fetchAll();
    }

    public static function create(array $t) {
        $s = self::pdo()->prepare("
            INSERT INTO tenants (slug, name, status, db_host, license_key, api_key, plan_code, modules_json, nexus_tenant_id, admin_email)
            VALUES (:slug, :name, 'provisioning', :db_host, :license_key, :api_key, :plan_code, :modules_json, :nexus_tenant_id, :admin_email)
        ");
        $s->execute([
            ':slug' => $t['slug'],
            ':name' => $t['name'],
            ':db_host' => $t['db_host'] ?? 'localhost',
            ':license_key' => $t['license_key'] ?? null,
            ':api_key' => $t['api_key'] ?? null,
            ':plan_code' => $t['plan_code'] ?? null,
            ':modules_json' => isset($t['modules']) ? json_encode(array_values($t['modules'])) : null,
            ':nexus_tenant_id' => $t['nexus_tenant_id'] ?? null,
            ':admin_email' => $t['admin_email'] ?? null,
        ]);
        return self::findBySlug($t['slug']);
    }

    /** Updates the given columns only. */
    public static function update($slug, array $fields) {
        $allowed = ['name', 'status', 'db_host', 'db_name', 'db_user', 'db_pass_enc', 'license_key', 'api_key',
                    'plan_code', 'modules_json', 'nexus_tenant_id', 'admin_email', 'provision_step', 'last_error'];
        $sets = []; $vals = [];
        foreach ($fields as $k => $v) {
            if (!in_array($k, $allowed, true)) continue;
            $sets[] = "`$k` = ?";
            $vals[] = $v;
        }
        if (!$sets) return;
        $vals[] = $slug;
        self::pdo()->prepare("UPDATE tenants SET " . implode(', ', $sets) . " WHERE slug = ?")->execute($vals);
        Tenancy::forgetCache();
    }

    public static function addDomain($slug, $domain, $kind = 'app') {
        $t = self::findBySlug($slug);
        if (!$t) throw new Exception("Unknown tenant '$slug'");
        $domain = strtolower(trim($domain));
        if (!preg_match('/^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$|^localhost$/', $domain)) {
            throw new Exception("'$domain' is not a valid domain name");
        }
        // A domain is never moved between tenants by accident
        $owner = self::findByDomain($domain);
        if ($owner) {
            if ($owner['slug'] !== $slug) throw new Exception("'$domain' already belongs to another workspace");
            return;
        }
        self::pdo()->prepare("INSERT INTO tenant_domains (tenant_id, domain, kind) VALUES (?, ?, ?)")
            ->execute([(int)$t['id'], $domain, $kind]);
        Tenancy::forgetCache();
    }

    /** Makes $domain the workspace's address (kind 'app') and drops its earlier app addresses. Custom domains are kept. */
    public static function replaceAppDomain($slug, $domain) {
        self::addDomain($slug, $domain, 'app');
        $t = self::findBySlug($slug);
        self::pdo()->prepare("DELETE FROM tenant_domains WHERE tenant_id = ? AND kind = 'app' AND domain <> ?")
            ->execute([(int)$t['id'], strtolower(trim($domain))]);
        Tenancy::forgetCache();
    }

    public static function removeDomain($domain) {
        self::pdo()->prepare("DELETE FROM tenant_domains WHERE domain = ?")->execute([strtolower(trim($domain))]);
        Tenancy::forgetCache();
    }

    // ---------------------------------------------------------------- secrets at rest

    /** Encrypts a tenant DB password with TENANCY_MASTER_KEY (AES-256-GCM). */
    public static function encrypt($plain) {
        $key = hash('sha256', TENANCY_MASTER_KEY, true);
        $iv = random_bytes(12);
        $tag = '';
        $ct = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        return 'v1:' . base64_encode($iv . $tag . $ct);
    }

    public static function decrypt($enc) {
        if (!is_string($enc) || strpos($enc, 'v1:') !== 0) return null;
        $raw = base64_decode(substr($enc, 3), true);
        if ($raw === false || strlen($raw) < 29) return null;
        $key = hash('sha256', TENANCY_MASTER_KEY, true);
        $plain = openssl_decrypt(substr($raw, 28), 'aes-256-gcm', $key, OPENSSL_RAW_DATA, substr($raw, 0, 12), substr($raw, 12, 16));
        return $plain === false ? null : $plain;
    }
}
