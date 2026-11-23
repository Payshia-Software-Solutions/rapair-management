<?php
/**
 * Provisioner
 * Creates, changes, pauses and removes BizzFlow workspaces on the shared deployment.
 * Called by Nexus webhooks (public/provision.php) and by the CLI (tools/tenants.php).
 *
 * create() runs these steps and records each one, so a failed run can simply be retried:
 *   database -> template -> schema -> seed -> domain -> active
 */
require_once __DIR__ . '/Tenancy.php';
require_once __DIR__ . '/DatabaseHost.php';

class Provisioner {
    const STEPS = ['database', 'template', 'schema', 'seed', 'domain', 'active'];

    /** @var callable|null */
    private $log;

    public function __construct(callable $log = null) {
        $this->log = $log;
    }

    private function say($msg) {
        if ($this->log) call_user_func($this->log, $msg);
    }

    public static function validSlug($slug) {
        return (bool)preg_match('/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/', $slug)
            && !in_array($slug, ['www', 'api', 'admin', 'app', 'mail', 'nexus', 'portal', 'status', 'static', 'cdn', 'staging'], true);
    }

    /**
     * New workspace.
     * $t: slug, name, admin_email, [admin_name, plan_code, modules[], license_key, api_key, nexus_tenant_id, domains[]]
     * Returns ['slug','url','admin_email','admin_password'] (password only when the admin was created now).
     */
    public function create(array $t) {
        $slug = strtolower(trim($t['slug'] ?? ''));
        if (!self::validSlug($slug)) throw new Exception("Workspace name '$slug' is not allowed (3-42 letters, numbers or dashes).");
        if (empty($t['name'])) throw new Exception('Company name is required.');
        if (empty($t['admin_email']) || !filter_var($t['admin_email'], FILTER_VALIDATE_EMAIL)) throw new Exception('A valid admin email is required.');

        $row = TenantRegistry::findBySlug($slug);
        if ($row && $row['status'] === 'active') {
            $this->say("Workspace '$slug' already exists and is active.");
            return ['slug' => $slug, 'url' => self::appUrl($slug), 'admin_email' => $row['admin_email'], 'admin_password' => null];
        }
        if ($row && $row['status'] === 'deleted') {
            // Left over from an older soft delete (or a delete that failed half way): clear it, start fresh
            $this->delete($slug);
            $row = null;
        }
        if (!$row) {
            $t['slug'] = $slug;
            $t['db_host'] = defined('TENANCY_TENANT_DB_HOST') ? TENANCY_TENANT_DB_HOST : 'localhost';
            $row = TenantRegistry::create($t);
            $this->say("Registered workspace '$slug'.");
        }

        $done = self::stepIndex($row['provision_step']);
        $adminPassword = null;
        try {
            if ($done < 0) { $this->stepDatabase($row); $row = $this->mark($slug, 'database'); }
            $pdo = $this->tenantPdo($row);
            if (self::stepIndex($row['provision_step']) < 1) { $this->stepTemplate($pdo); $row = $this->mark($slug, 'template'); }
            if (self::stepIndex($row['provision_step']) < 2) { $this->stepSchema($pdo); $row = $this->mark($slug, 'schema'); }
            if (self::stepIndex($row['provision_step']) < 3) { $adminPassword = $this->stepSeed($pdo, $t, $row); $row = $this->mark($slug, 'seed'); }
            if (self::stepIndex($row['provision_step']) < 4) {
                TenantRegistry::addDomain($slug, self::appDomain($slug), 'app');
                foreach ((array)($t['domains'] ?? []) as $d) TenantRegistry::addDomain($slug, $d, 'custom');
                $row = $this->mark($slug, 'domain');
            }
            TenantRegistry::update($slug, ['status' => 'active', 'provision_step' => 'active', 'last_error' => null]);
            $this->say("Workspace '$slug' is ready: " . self::appUrl($slug));
        } catch (Throwable $e) {
            TenantRegistry::update($slug, ['status' => 'failed', 'last_error' => mb_substr($e->getMessage(), 0, 2000)]);
            throw $e;
        }

        return ['slug' => $slug, 'url' => self::appUrl($slug), 'admin_email' => $t['admin_email'], 'admin_password' => $adminPassword];
    }

    private static function stepIndex($step) {
        $i = array_search($step, self::STEPS, true);
        return $i === false ? -1 : $i;
    }

    private function mark($slug, $step) {
        TenantRegistry::update($slug, ['provision_step' => $step]);
        $this->say("  ✓ $step");
        return TenantRegistry::findBySlug($slug);
    }

    // ---------------------------------------------------------------- steps

    private function stepDatabase(array $row) {
        $host = DatabaseHostFactory::make();
        $prefix = $host->prefix();
        $base = str_replace('-', '_', $row['slug']);
        // MySQL limits: database 64 chars, user 32 chars (cPanel counts its prefix)
        $dbName = $row['db_name'] ?: substr($prefix . 'bf_' . $base, 0, 64);
        $dbUser = $row['db_user'] ?: substr($prefix . 'bf' . substr($base, 0, 16) . substr(md5($row['slug']), 0, 4), 0, 32);
        $pass = $row['db_pass_enc'] ? TenantRegistry::decrypt($row['db_pass_enc']) : null;
        if (!$pass) $pass = rtrim(strtr(base64_encode(random_bytes(24)), '+/', 'Ab'), '=') . '9x';

        // Save names + password first: a retry then reuses the same ones
        TenantRegistry::update($row['slug'], ['db_name' => $dbName, 'db_user' => $dbUser, 'db_pass_enc' => TenantRegistry::encrypt($pass)]);

        $host->createDatabase($dbName);
        $host->createUser($dbUser, $pass);
        $host->grantAll($dbUser, $dbName);
    }

    private function tenantPdo(array $row) {
        $pass = TenantRegistry::decrypt($row['db_pass_enc']);
        if ($pass === null) throw new Exception('Stored database password could not be read (master key changed?)');
        return new PDO("mysql:host={$row['db_host']};dbname={$row['db_name']};charset=utf8mb4", $row['db_user'], $pass,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }

    /** Imports the clean template, unless this database already has the app's tables. */
    private function stepTemplate(PDO $pdo) {
        if ($pdo->query("SHOW TABLES LIKE 'users'")->fetch()) { $this->say('  (template already imported)'); return; }
        $file = defined('TENANCY_TEMPLATE_SQL') ? TENANCY_TEMPLATE_SQL : APPROOT . '/clean_database_template.sql';
        if (!is_file($file)) throw new Exception("Template SQL not found: $file");
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        $n = 0;
        foreach (self::splitSql((string)file_get_contents($file)) as $stmt) {
            $pdo->exec($stmt);
            $n++;
        }
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        $this->say("  imported $n statements");
    }

    /** Brings the database up to the current SchemaDefinition (same code as Admin → Database Schema). */
    private function stepSchema(PDO $pdo) {
        require_once APPROOT . '/app/core/SchemaHelper.php';
        $helper = new SchemaHelper(new TenantRawDb($pdo));
        $diff = $helper->getDiff();
        if (!empty($diff['missing_tables']) || !empty($diff['missing_columns']) || !empty($diff['missing_indexes'])) {
            $helper->sync($diff);
        }
        $after = $helper->getDiff();
        $left = count($after['missing_tables'] ?? []) + count($after['missing_columns'] ?? []);
        if ($left > 0) throw new Exception("Schema sync left $left tables/columns missing");
    }

    /** Company, branch and admin login. Returns the new admin password. */
    private function stepSeed(PDO $pdo, array $t, array $row) {
        $name = mb_substr(trim($t['name'] ?: $row['name']), 0, 190);
        $pdo->prepare("UPDATE service_locations SET name = ? WHERE id = 1")->execute([$name]);
        // The template carries the source install's credentials (mail server, SMS gateway, licence key,
        // payment and API keys). A new workspace must start with none of them: blank or fresh values.
        self::scrubSettings($pdo);

        // The app reads and writes company row id 1 (Company model)
        if (!$pdo->query("SELECT id FROM company WHERE id = 1")->fetch()) {
            try { $pdo->prepare("INSERT INTO company (id, name) VALUES (1, ?)")->execute([$name]); }
            catch (Exception $e) { $this->say('  (company profile left for the setup wizard: ' . $e->getMessage() . ')'); }
        } else {
            $pdo->prepare("UPDATE company SET name = ? WHERE id = 1")->execute([$name]);
        }

        // Admin: the template's admin@local becomes the client's admin with a fresh password
        $email = strtolower(trim($t['admin_email'] ?: $row['admin_email']));
        $password = self::readablePassword();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $adminName = mb_substr(trim($t['admin_name'] ?? 'Administrator'), 0, 100) ?: 'Administrator';
        $roleId = (int)($pdo->query("SELECT id FROM roles WHERE name = 'Admin' LIMIT 1")->fetchColumn() ?: 1);
        $existing = $pdo->query("SELECT id FROM users ORDER BY id LIMIT 1")->fetchColumn();
        if ($existing) {
            $pdo->prepare("UPDATE users SET name = ?, email = ?, password_hash = ?, role_id = ?, is_active = 1 WHERE id = ?")
                ->execute([$adminName, $email, $hash, $roleId, (int)$existing]);
        } else {
            $pdo->prepare("INSERT INTO users (name, email, password_hash, role_id, location_id, is_active) VALUES (?, ?, ?, ?, 1, 1)")
                ->execute([$adminName, $email, $hash, $roleId]);
        }
        TenantRegistry::update($row['slug'], ['admin_email' => $email]);
        return $password;
    }

    /** Settings that must never be copied from the template into a client's workspace. */
    const SCRUB_SETTINGS = [
        'mail_host', 'mail_port', 'mail_user', 'mail_pass', 'mail_from_addr', 'mail_from_name',
        'sms_gateway_url', 'sms_api_key', 'sms_sender_id',
        'nexus_api_key',                       // would override the workspace's own licence (SaasHelper)
        'FLEET_API_URL', 'FLEET_API_TOKEN', 'MILEAGE_API_URL', 'MILEAGE_API_TOKEN',
        'payhere_merchant_id_live', 'payhere_secret_live', 'payhere_merchant_id_sandbox', 'payhere_secret_sandbox',
        'stripe_publishable_key_live', 'stripe_secret_key_live', 'stripe_publishable_key_sandbox', 'stripe_secret_key_sandbox',
        'setup_completed', 'setup_location_done', 'setup_taxes_done', 'setup_mail_skipped', 'setup_sms_skipped',
    ];

    public static function scrubSettings(PDO $pdo) {
        if (!$pdo->query("SHOW TABLES LIKE 'system_settings'")->fetch()) return;
        $in = implode(',', array_fill(0, count(self::SCRUB_SETTINGS), '?'));
        $pdo->prepare("UPDATE system_settings SET setting_value = '' WHERE setting_key IN ($in)")->execute(self::SCRUB_SETTINGS);
        // Keys other systems use to call this workspace: a fresh one per workspace
        $pdo->prepare("UPDATE system_settings SET setting_value = ? WHERE setting_key = 'PUBLIC_WEBSITE_API_KEY'")->execute([bin2hex(random_bytes(32))]);
        // AI provider keys (ai_*_key etc.)
        $pdo->exec("UPDATE system_settings SET setting_value = '' WHERE setting_key LIKE 'ai\\_%key%' OR setting_key LIKE 'ai\\_%secret%' OR setting_key LIKE 'ai\\_%token%'");
    }

    // ---------------------------------------------------------------- lifecycle

    public function changePlan($slug, $planCode, array $modules = null, $licenseKey = null, $apiKey = null) {
        $f = ['plan_code' => $planCode];
        if ($modules !== null) $f['modules_json'] = json_encode(array_values($modules));
        if ($licenseKey !== null) $f['license_key'] = $licenseKey;
        if ($apiKey !== null) $f['api_key'] = $apiKey;
        self::requireTenant($slug);
        TenantRegistry::update($slug, $f);
        // Drop the workspace's cached licence so the new plan applies on the next request
        @unlink(APPROOT . "/scratch/tenants/$slug/nexus_license.json");
        @unlink(APPROOT . "/scratch/tenants/$slug/license_cache.json");
    }

    public function suspend($slug) { self::requireTenant($slug); TenantRegistry::update($slug, ['status' => 'suspended']); }

    public function resume($slug) {
        $t = self::requireTenant($slug);
        if ($t['provision_step'] !== 'active') throw new Exception("Workspace '$slug' never finished setting up; run create again.");
        TenantRegistry::update($slug, ['status' => 'active']);
    }

    /**
     * Full delete: drops the workspace's database and DB user, removes its registry row and domains
     * (domains cascade) and its local files. The name is free again, so a new workspace with the
     * same name starts fresh. Already gone = success, so Nexus retries are safe.
     */
    public function delete($slug) {
        $slug = strtolower(trim((string)$slug));
        $t = TenantRegistry::findBySlug($slug);
        if (!$t) { $this->say("Workspace '$slug' does not exist (already deleted)."); return; }
        // Stop it working first, so nobody uses it while the database is dropped
        TenantRegistry::update($slug, ['status' => 'deleted']);
        $host = DatabaseHostFactory::make();
        try {
            if ($t['db_name']) self::dropQuietly(function () use ($host, $t) { $host->dropDatabase($t['db_name']); });
            if ($t['db_user']) self::dropQuietly(function () use ($host, $t) { $host->dropUser($t['db_user']); });
        } catch (Throwable $e) {
            TenantRegistry::update($slug, ['last_error' => mb_substr('Delete failed: ' . $e->getMessage(), 0, 2000)]);
            throw $e;
        }
        TenantRegistry::pdo()->prepare("DELETE FROM tenants WHERE slug = ?")->execute([$slug]);
        self::removeDir(APPROOT . "/scratch/tenants/$slug");
        Tenancy::forgetCache();
        $this->say("Workspace '$slug' and its database were deleted.");
    }

    /** Same as delete(); kept for the CLI. */
    public function purge($slug) { $this->delete($slug); }

    /** Runs a drop; a database/user that is already gone is not an error. */
    private static function dropQuietly(callable $fn) {
        try { $fn(); }
        catch (Throwable $e) {
            if (preg_match('/not exist|does not exist|doesn\'t exist|no such|not found|unknown database/i', $e->getMessage())) return;
            throw $e;
        }
    }

    private static function removeDir($dir) {
        if (!is_dir($dir)) return;
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $f) {
            $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        }
        @rmdir($dir);
    }

    /** Brings one workspace's database up to the current schema (run after each deploy). */
    public function migrate($slug) {
        $t = self::requireTenant($slug);
        $this->stepSchema($this->tenantPdo($t));
    }

    /**
     * Moves the workspace to a new address (e.g. acme.example.com) without touching its internal slug,
     * so logins, uploads and the database stay as they are. The old address stops working.
     */
    public function changeAddress($slug, $label) {
        $label = strtolower(trim((string)$label));
        if (!self::validSlug($label)) throw new InvalidArgumentException("Address '$label' is not allowed (3-42 letters, numbers or dashes).");
        self::requireTenant($slug);
        TenantRegistry::replaceAppDomain($slug, self::appDomain($label));
        return ['slug' => $slug, 'url' => self::appUrl($label)];
    }

    private static function requireTenant($slug) {
        $t = TenantRegistry::findBySlug($slug);
        if (!$t) throw new Exception("No workspace '$slug'");
        return $t;
    }

    // ---------------------------------------------------------------- helpers

    public static function appDomain($slug) {
        if (!defined('TENANCY_BASE_DOMAIN') || TENANCY_BASE_DOMAIN === '') throw new Exception('TENANCY_BASE_DOMAIN is not set in config.php');
        return $slug . '.' . TENANCY_BASE_DOMAIN;
    }

    /** Web address of a workspace. TENANCY_APP_URL_TEMPLATE overrides it, e.g. 'http://{slug}.localhost:9010' locally. */
    public static function appUrl($slug) {
        if (defined('TENANCY_APP_URL_TEMPLATE') && TENANCY_APP_URL_TEMPLATE !== '') return str_replace('{slug}', $slug, TENANCY_APP_URL_TEMPLATE);
        return 'https://' . self::appDomain($slug);
    }

    private static function readablePassword() {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
        $p = '';
        for ($i = 0; $i < 14; $i++) $p .= $chars[random_int(0, strlen($chars) - 1)];
        return $p;
    }

    /** Splits a SQL dump into statements (quotes, escapes and comments aware). */
    public static function splitSql($sql) {
        $out = []; $buf = ''; $len = strlen($sql); $q = null;
        for ($i = 0; $i < $len; $i++) {
            $c = $sql[$i];
            if ($q !== null) {
                $buf .= $c;
                if ($c === '\\' && $q !== '`' && $i + 1 < $len) { $buf .= $sql[++$i]; continue; }
                if ($c === $q) {
                    if ($i + 1 < $len && $sql[$i + 1] === $q) { $buf .= $sql[++$i]; continue; } // doubled quote
                    $q = null;
                }
                continue;
            }
            if ($c === "'" || $c === '"' || $c === '`') { $q = $c; $buf .= $c; continue; }
            if ($c === '-' && substr($sql, $i, 3) === '-- ' || ($c === '#' && trim($buf) === '')) {
                $nl = strpos($sql, "\n", $i); $i = $nl === false ? $len : $nl; $buf .= "\n"; continue;
            }
            if ($c === '/' && substr($sql, $i, 2) === '/*') {
                $end = strpos($sql, '*/', $i + 2);
                $comment = substr($sql, $i, $end === false ? $len - $i : $end + 2 - $i);
                if (strpos($comment, '/*!') === 0) $buf .= $comment; // MySQL conditional: keep
                $i = $end === false ? $len : $end + 1;
                continue;
            }
            if ($c === ';') {
                if (trim($buf) !== '') $out[] = trim($buf);
                $buf = '';
                continue;
            }
            $buf .= $c;
        }
        if (trim($buf) !== '') $out[] = trim($buf);
        return $out;
    }
}

/** Gives SchemaHelper (which expects the app's Database) a connection to a tenant database. */
class TenantRawDb {
    private $pdo;
    public function __construct(PDO $pdo) { $this->pdo = $pdo; }
    public function rawQuery($sql) { return $this->pdo->query($sql); }
}
