<?php
/**
 * Server configuration: one file for every environment. All values come from server/.env.
 *
 *   1. Copy this file to config/config.php (gitignored: it is placed per machine, never deployed).
 *   2. Copy server/.env.example to server/.env and fill it in (also gitignored).
 *
 * APP_MODE=single  one customer, one database (a client install, or local development)
 * APP_MODE=shared  many workspaces on one server: each request picks its workspace and database from
 *                  the control database (Tenancy::boot defines DB_*, TENANT_SLUG, NEXUS_*_KEY, JWT_SECRET)
 *
 * Only the keys of the chosen mode are defined, so the two modes can never define the same constant twice.
 */

require_once __DIR__ . '/../app/core/Env.php';

date_default_timezone_set(Env::get('APP_TIMEZONE', 'Asia/Colombo'));

define('APPROOT', dirname(__DIR__));
define('URLROOT', rtrim(Env::get('URLROOT', 'http://localhost/rapair-management/server'), '/'));
define('SITENAME', Env::get('SITENAME', 'Repair Management API'));

// Same in both modes
define('JWT_ISSUER', Env::get('JWT_ISSUER', 'repair-management'));
define('JWT_TTL_SECONDS', Env::int('JWT_TTL_SECONDS', 28800));
define('GOOGLE_CLIENT_ID', Env::get('GOOGLE_CLIENT_ID', ''));

// Nexus portal: the API root WITHOUT /api (the server adds /api/saas/...)
define('NEXUS_PORTAL_URL', rtrim(Env::get('NEXUS_PORTAL_URL', 'https://api-saas.nebulync.com'), '/'));

// FTP to the content server (uploaded files go there instead of this server). Leave unset in development.
if (Env::get('FTP_HOST') && Env::get('FTP_PASS')) {
    define('FTP_HOST', Env::get('FTP_HOST'));
    define('FTP_PORT', Env::int('FTP_PORT', 21));
    define('FTP_USER', Env::get('FTP_USER', ''));
    define('FTP_PASS', Env::get('FTP_PASS'));
}

if (Env::get('APP_MODE', 'single') === 'shared') {
    // ---- Control database (the workspace registry; holds no business data)
    define('TENANCY_CONTROL_DB_HOST', Env::get('TENANCY_CONTROL_DB_HOST', 'localhost'));
    define('TENANCY_CONTROL_DB_NAME', Env::need('TENANCY_CONTROL_DB_NAME'));
    define('TENANCY_CONTROL_DB_USER', Env::need('TENANCY_CONTROL_DB_USER'));
    define('TENANCY_CONTROL_DB_PASS', Env::get('TENANCY_CONTROL_DB_PASS', ''));

    // ---- Secrets (generate each with: php -r "echo bin2hex(random_bytes(32));")
    // MASTER_KEY encrypts workspace DB passwords and derives each workspace's login-token key.
    // Never change it once a workspace exists.
    define('TENANCY_MASTER_KEY', Env::need('TENANCY_MASTER_KEY'));
    // Must equal the webhook secret of this product in Nexus (Admin -> Products)
    define('TENANCY_WEBHOOK_SECRET', Env::need('TENANCY_WEBHOOK_SECRET'));

    // ---- Domains
    define('TENANCY_BASE_DOMAIN', Env::get('TENANCY_BASE_DOMAIN', 'localhost'));
    define('TENANCY_API_HOSTS', Env::get('TENANCY_API_HOSTS', ''));
    if (Env::get('TENANCY_APP_URL_TEMPLATE')) define('TENANCY_APP_URL_TEMPLATE', Env::get('TENANCY_APP_URL_TEMPLATE'));

    // ---- Where workspace databases are created: 'cpanel' (shared hosting) or 'mysql' (VPS / managed MySQL)
    define('TENANCY_DB_DRIVER', Env::get('TENANCY_DB_DRIVER', 'mysql'));
    define('TENANCY_TENANT_DB_HOST', Env::get('TENANCY_TENANT_DB_HOST', 'localhost'));
    foreach (['TENANCY_CPANEL_URL', 'TENANCY_CPANEL_USER', 'TENANCY_CPANEL_TOKEN',
              'TENANCY_DB_ADMIN_HOST', 'TENANCY_DB_ADMIN_USER', 'TENANCY_DB_ADMIN_PASS', 'TENANCY_DB_USER_HOST'] as $k) {
        if (Env::get($k) !== null) define($k, Env::get($k));
    }

    // Content server root; each workspace gets <root>/t/<slug>/ (CONTENT_BASE_URL is set per workspace)
    define('TENANCY_CONTENT_BASE_URL', Env::get('CONTENT_BASE_URL', 'https://content-provider.payshia.com/service-center-system/'));

    // Pick the workspace for this request
    require_once APPROOT . '/app/tenancy/Tenancy.php';
    if (!defined('TENANCY_SKIP_BOOT')) Tenancy::boot();
} else {
    // ---- Single install: one database
    define('DB_HOST', Env::get('DB_HOST', '127.0.0.1'));
    define('DB_USER', Env::get('DB_USER', 'root'));
    define('DB_PASS', Env::get('DB_PASS', ''));
    define('DB_NAME', Env::need('DB_NAME'));
    define('JWT_SECRET', Env::need('JWT_SECRET'));

    // Licence for this install (the Nexus portal gives you these)
    define('NEXUS_API_KEY', Env::get('NEXUS_API_KEY', ''));
    define('NEXUS_LICENSE_KEY', Env::get('NEXUS_LICENSE_KEY', ''));

    define('CONTENT_BASE_URL', Env::get('CONTENT_BASE_URL', 'https://content-provider.payshia.com/service-center-system/'));
}
