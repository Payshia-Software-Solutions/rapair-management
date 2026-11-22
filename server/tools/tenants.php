<?php
/**
 * Workspace admin for the shared (multi-tenant) deployment.
 *
 *   php tools/tenants.php init                                   create the control tables
 *   php tools/tenants.php list
 *   php tools/tenants.php create <slug> "<Company>" <admin-email> [--plan=CODE] [--modules=pos,accounting] [--domain=erp.client.com]
 *   php tools/tenants.php migrate <slug>|--all                   schema sync (run after every deploy)
 *   php tools/tenants.php suspend|resume|delete <slug>
 *   php tools/tenants.php purge <slug>                           drop database + user (only after delete)
 *   php tools/tenants.php domain-add <slug> <domain>
 *   php tools/tenants.php domain-remove <domain>
 *   php tools/tenants.php run <slug>|--all <script.php> [args]   run a script (e.g. a cron job) for workspaces
 *   php tools/tenants.php attach <slug> "<Company>" <db_name> <db_user> <db_pass> [--domain=...]
 *        register an EXISTING client database (moving a client onto the shared deployment; no data copied)
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

define('TENANCY_SKIP_BOOT', true);
chdir(__DIR__ . '/../public'); // app code uses paths relative to public/
// BF_CONFIG_PATH: a deployment folder that reuses this code (e.g. a local shared setup) points at its own config
require_once defined('BF_CONFIG_PATH') ? BF_CONFIG_PATH : __DIR__ . '/../config/config.php';
if (!class_exists('Tenancy', false)) {
    fwrite(STDERR, "This server's config.php is not a shared-deployment config (set APP_MODE=shared in .env, see config/config.example.php).\n");
    exit(1);
}
require_once APPROOT . '/app/tenancy/Provisioner.php';

$args = array_slice($argv, 1);
$opts = [];
$pos = [];
foreach ($args as $a) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $a, $m)) $opts[$m[1]] = $m[2] ?? true;
    else $pos[] = $a;
}
$cmd = array_shift($pos) ?: 'help';
$out = function ($m) { echo $m, PHP_EOL; };
$p = new Provisioner($out);

function need($v, $what) {
    if ($v === null || $v === '') { fwrite(STDERR, "Missing $what\n"); exit(1); }
    return $v;
}

function slugs_for($target) {
    if ($target === '--all' || $target === true) {
        return array_column(array_filter(TenantRegistry::all(), function ($t) { return $t['status'] === 'active'; }), 'slug');
    }
    return [$target];
}

try {
    switch ($cmd) {
        case 'init':
            TenantRegistry::ensureSchema();
            $out('Control tables ready.');
            break;

        case 'list':
            foreach (TenantRegistry::all(true) as $t) {
                printf("%-24s %-11s %-10s %-28s %s\n", $t['slug'], $t['status'], $t['provision_step'] ?: '-', $t['db_name'] ?: '-', $t['domains'] ?: '');
            }
            break;

        case 'create':
            $r = $p->create([
                'slug' => need($pos[0] ?? null, 'slug'),
                'name' => need($pos[1] ?? null, 'company name'),
                'admin_email' => need($pos[2] ?? null, 'admin email'),
                'plan_code' => $opts['plan'] ?? null,
                'modules' => isset($opts['modules']) ? array_filter(explode(',', $opts['modules'])) : null,
                'domains' => isset($opts['domain']) ? [$opts['domain']] : [],
            ]);
            $out("URL:      {$r['url']}");
            $out("Login:    {$r['admin_email']}");
            if ($r['admin_password']) $out("Password: {$r['admin_password']}   (shown once; ask the client to change it)");
            break;

        case 'attach':
            // Existing single-client database -> shared deployment. Nothing is copied or changed in it.
            $slug = need($pos[0] ?? null, 'slug');
            if (!Provisioner::validSlug($slug)) throw new Exception("Bad slug '$slug'");
            if (TenantRegistry::findBySlug($slug)) throw new Exception("'$slug' already exists");
            TenantRegistry::create(['slug' => $slug, 'name' => need($pos[1] ?? null, 'company name'),
                'db_host' => defined('TENANCY_TENANT_DB_HOST') ? TENANCY_TENANT_DB_HOST : 'localhost']);
            TenantRegistry::update($slug, ['db_name' => need($pos[2] ?? null, 'db name'), 'db_user' => need($pos[3] ?? null, 'db user'),
                'db_pass_enc' => TenantRegistry::encrypt(need($pos[4] ?? null, 'db password')), 'provision_step' => 'seed']);
            // Check the credentials work before going live
            $t = TenantRegistry::findBySlug($slug);
            new PDO("mysql:host={$t['db_host']};dbname={$t['db_name']}", $t['db_user'], TenantRegistry::decrypt($t['db_pass_enc']));
            TenantRegistry::addDomain($slug, Provisioner::appDomain($slug), 'app');
            if (!empty($opts['domain'])) TenantRegistry::addDomain($slug, $opts['domain'], 'custom');
            TenantRegistry::update($slug, ['status' => 'active', 'provision_step' => 'active']);
            $out("Attached '$slug' at " . Provisioner::appUrl($slug) . ". Run: php tools/tenants.php migrate $slug");
            break;

        case 'migrate':
            $failed = 0;
            foreach (slugs_for(need($pos[0] ?? ($opts['all'] ?? null), 'slug or --all')) as $slug) {
                try { $p->migrate($slug); $out("✓ $slug"); }
                catch (Throwable $e) { $failed++; $out("✗ $slug: " . $e->getMessage()); }
            }
            exit($failed ? 1 : 0);

        case 'suspend': $p->suspend(need($pos[0] ?? null, 'slug')); $out('Suspended.'); break;
        case 'resume':  $p->resume(need($pos[0] ?? null, 'slug'));  $out('Resumed.'); break;
        case 'delete':  $p->delete(need($pos[0] ?? null, 'slug'));  $out('Deleted (database kept). Use purge to remove it.'); break;
        case 'purge':
            $slug = need($pos[0] ?? null, 'slug');
            if (empty($opts['yes'])) { fwrite(STDERR, "This permanently drops $slug's database. Re-run with --yes.\n"); exit(1); }
            $p->purge($slug);
            $out('Purged.');
            break;

        case 'domain-add':    TenantRegistry::addDomain(need($pos[0] ?? null, 'slug'), need($pos[1] ?? null, 'domain'), 'custom'); $out('Added.'); break;
        case 'domain-remove': TenantRegistry::removeDomain(need($pos[0] ?? null, 'domain')); $out('Removed.'); break;

        case 'run':
            $target = need($pos[0] ?? ($opts['all'] ?? null), 'slug or --all');
            if ($target === true) $script = need($pos[0] ?? null, 'script');
            else $script = need($pos[1] ?? null, 'script');
            $extra = array_slice($pos, $target === true ? 1 : 2);
            $script = realpath($script) ?: realpath(APPROOT . '/' . $script);
            if (!$script) throw new Exception('Script not found');
            $failed = 0;
            foreach (slugs_for($target) as $slug) {
                $cmdline = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($script) . ' ' . implode(' ', array_map('escapeshellarg', $extra));
                // Separate process per workspace: constants (DB_NAME...) can be set only once per process
                $proc = proc_open($cmdline, [1 => STDOUT, 2 => STDERR], $pipes, dirname($script), array_merge(getenv(), ['BF_TENANT' => $slug]));
                $code = is_resource($proc) ? proc_close($proc) : 1;
                if ($code !== 0) { $failed++; $out("✗ $slug (exit $code)"); }
            }
            exit($failed ? 1 : 0);

        default:
            $out(trim(preg_replace('/^ \* ?/m', '', explode('*/', explode('/**', file_get_contents(__FILE__), 2)[1])[0])));
    }
} catch (Throwable $e) {
    fwrite(STDERR, 'Error: ' . $e->getMessage() . PHP_EOL);
    exit(1);
}
