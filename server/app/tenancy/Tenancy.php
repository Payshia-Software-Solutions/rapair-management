<?php
/**
 * Tenancy
 * Picks the tenant for this request on the shared deployment and defines the constants the
 * rest of the app already uses (DB_*, TENANT_SLUG, NEXUS_*, JWT_SECRET). No controller or
 * model needs to know about tenants.
 *
 * Single-client installs: their config.php never calls Tenancy::boot(), so nothing changes;
 * scratchPath()/uploadDir() then return the same paths as before.
 *
 * How the tenant is found:
 *   - CLI (cron, tools): environment variable BF_TENANT=<slug>
 *   - Web: the request host, looked up in tenant_domains (teajar.bizzflow.nebulync.com, erp.client.com)
 *   - Web on a shared API host (TENANCY_API_HOSTS): the X-Tenant header the frontend sends
 * Unknown host -> "Workspace not found". There is never a fallback to another tenant's database.
 */
require_once __DIR__ . '/TenantRegistry.php';

class Tenancy {
    private static $tenant = null;
    const CACHE_TTL = 60;

    public static function enabled() { return self::$tenant !== null; }
    public static function slug() { return self::$tenant['slug'] ?? null; }
    public static function current() { return self::$tenant; }

    /** Plan modules from the registry (null = not set; the Nexus licence check decides). */
    public static function modules() {
        if (!self::$tenant || empty(self::$tenant['modules_json'])) return null;
        $m = json_decode(self::$tenant['modules_json'], true);
        return is_array($m) ? $m : null;
    }

    public static function boot() {
        foreach (['TENANCY_CONTROL_DB_HOST', 'TENANCY_CONTROL_DB_NAME', 'TENANCY_CONTROL_DB_USER', 'TENANCY_CONTROL_DB_PASS', 'TENANCY_MASTER_KEY'] as $c) {
            if (!defined($c)) self::reject(500, 'tenancy_misconfigured', "Server setup incomplete ($c is missing).");
        }
        if (strlen(TENANCY_MASTER_KEY) < 32) self::reject(500, 'tenancy_misconfigured', 'Server setup incomplete (master key too short).');

        // CORS preflight carries no X-Tenant value and touches no data; index.php answers it
        // before any database code is loaded.
        if (PHP_SAPI !== 'cli' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') return;

        try {
            $t = self::resolve();
        } catch (Throwable $e) {
            error_log('Tenancy: registry unavailable: ' . $e->getMessage());
            self::reject(503, 'registry_unavailable', 'The service is temporarily unavailable. Please try again in a minute.');
        }
        if (!$t || $t['status'] === 'deleted') self::reject(404, 'workspace_not_found', 'This workspace does not exist. Check the address.');
        if ($t['status'] === 'suspended') self::reject(402, 'workspace_suspended', 'This workspace is paused. Please contact your administrator about the subscription.',
            ['workspace' => (string)($t['name'] ?? ''), 'since' => substr((string)($t['updated_at'] ?? ''), 0, 10)]);
        if ($t['status'] !== 'active') self::reject(503, 'workspace_not_ready', 'This workspace is still being set up. Please try again shortly.');

        $pass = TenantRegistry::decrypt($t['db_pass_enc']);
        if ($pass === null || empty($t['db_name']) || empty($t['db_user'])) {
            error_log("Tenancy: tenant '{$t['slug']}' has no usable database credentials");
            self::reject(503, 'workspace_not_ready', 'This workspace is not available right now.');
        }

        self::$tenant = $t;
        define('DB_HOST', $t['db_host'] ?: 'localhost');
        define('DB_USER', $t['db_user']);
        define('DB_PASS', $pass);
        define('DB_NAME', $t['db_name']);
        define('TENANT_SLUG', $t['slug']);
        define('NEXUS_LICENSE_KEY', (string)($t['license_key'] ?? ''));
        define('NEXUS_API_KEY', (string)($t['api_key'] ?? ''));
        // Per-tenant signing key: a login token from one workspace is worthless on another
        define('JWT_SECRET', hash_hmac('sha256', 'jwt:' . $t['slug'], TENANCY_MASTER_KEY));
        // Content server: each workspace has its own folder (FtpStorage uploads there too)
        if (defined('TENANCY_CONTENT_BASE_URL') && !defined('CONTENT_BASE_URL')) {
            define('CONTENT_BASE_URL', rtrim(TENANCY_CONTENT_BASE_URL, '/') . '/t/' . $t['slug'] . '/');
        }
    }

    private static function resolve() {
        if (PHP_SAPI === 'cli') {
            $slug = getenv('BF_TENANT');
            if (!$slug) self::reject(500, 'tenant_required', 'Set BF_TENANT=<slug> to run this for a workspace.');
            return TenantRegistry::findBySlug($slug);
        }

        $host = strtolower(preg_replace('/:\d+$/', '', (string)($_SERVER['HTTP_HOST'] ?? '')));
        $apiHosts = defined('TENANCY_API_HOSTS') ? array_filter(array_map('trim', explode(',', strtolower(TENANCY_API_HOSTS)))) : [];

        if (in_array($host, $apiHosts, true)) {
            // Apps that can't send headers (printer bridge, mobile/desktop POS) use the workspace in the
            // path: https://api.../server/public/t/<slug>/api/... -> the prefix is removed for the router.
            if (isset($_GET['url']) && preg_match('#^t/([a-z0-9][a-z0-9-]{1,62})(?:/(.*))?$#', (string)$_GET['url'], $m)) {
                $_GET['url'] = $m[2] ?? '';
                if ($_GET['url'] === '') unset($_GET['url']);
                $slug = $m[1];
                return self::cached('slug:' . $slug, function () use ($slug) { return TenantRegistry::findBySlug($slug); });
            }
            // The web app sends the domain it is open on (subdomain or custom domain)
            $pageHost = strtolower(trim((string)($_SERVER['HTTP_X_TENANT_HOST'] ?? $_GET['_th'] ?? '')));
            if ($pageHost !== '') {
                if (!preg_match('/^[a-z0-9.-]{1,253}$/', $pageHost)) return null;
                return self::cached('host:' . $pageHost, function () use ($pageHost) { return TenantRegistry::findByDomain($pageHost); });
            }
            // Tools / printer app: the workspace name directly
            $slug = strtolower(trim((string)($_SERVER['HTTP_X_TENANT'] ?? $_GET['_tenant'] ?? '')));
            if (!preg_match('/^[a-z0-9][a-z0-9-]{1,62}$/', $slug)) return null;
            return self::cached('slug:' . $slug, function () use ($slug) { return TenantRegistry::findBySlug($slug); });
        }
        if ($host === '') return null;
        return self::cached('host:' . $host, function () use ($host) { return TenantRegistry::findByDomain($host); });
    }

    /** True when $host is a domain registered to any workspace (CORS for custom domains). */
    public static function isRegisteredDomain($host) {
        $host = strtolower((string)$host);
        if ($host === '' || !preg_match('/^[a-z0-9.-]+$/', $host)) return false;
        try {
            return (bool)self::cached('host:' . $host, function () use ($host) { return TenantRegistry::findByDomain($host); });
        } catch (Throwable $e) {
            return false;
        }
    }

    // ---------------------------------------------------------------- small lookup cache (per server, 60s)

    private static function cacheDir() {
        return APPROOT . '/scratch/tenancy';
    }

    private static function cached($key, callable $load) {
        $file = self::cacheDir() . '/' . md5($key) . '.json';
        if (is_file($file) && (time() - filemtime($file)) < self::CACHE_TTL) {
            $row = json_decode((string)@file_get_contents($file), true);
            if (is_array($row)) return $row ?: null;
        }
        $row = $load();
        if (!is_dir(self::cacheDir())) @mkdir(self::cacheDir(), 0750, true);
        @file_put_contents($file, json_encode($row ?: []), LOCK_EX);
        return $row;
    }

    public static function forgetCache() {
        foreach (glob(self::cacheDir() . '/*.json') ?: [] as $f) @unlink($f);
    }

    // ---------------------------------------------------------------- per-tenant files

    /** Where a cache/state file lives: per tenant on the shared deployment, unchanged otherwise. */
    public static function scratchPath($file) {
        if (!self::$tenant) return APPROOT . '/scratch/' . $file;
        $dir = APPROOT . '/scratch/tenants/' . self::$tenant['slug'];
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        return $dir . '/' . $file;
    }

    /**
     * Upload folder for a kind of file (company, customers, slips, reviews).
     * Returns [absolute dir, path relative to public/]. Per tenant on the shared deployment.
     */
    public static function uploadDir($sub) {
        $rel = self::$tenant ? 'uploads/t/' . self::$tenant['slug'] . '/' . $sub : 'uploads/' . $sub;
        $abs = APPROOT . '/public/' . $rel;
        if (!is_dir($abs)) @mkdir($abs, 0755, true);
        return [$abs, $rel];
    }

    // ---------------------------------------------------------------- errors

    private static function reject($code, $errCode, $message, array $extra = []) {
        if (PHP_SAPI === 'cli') {
            fwrite(STDERR, "[$errCode] $message\n");
            exit(1);
        }
        http_response_code($code);
        // Let the browser read the error (CORS headers are normally added later in index.php)
        if (!empty($_SERVER['HTTP_ORIGIN'])) {
            header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
            header('Vary: Origin');
        }
        header('Content-Type: application/json');
        echo json_encode(['status' => 'error', 'code' => $errCode, 'message' => $message] + $extra);
        exit;
    }
}
