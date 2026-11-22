<?php
/**
 * Config - reads from nexus-portal-server/.env (production + local).
 *
 * Call sites write `Config::DB_HOST()` (not a constant), so values can be swapped per environment
 * without editing PHP. The .env file is gitignored; copy .env.example and fill it in.
 *
 * MAIL_DISABLED=true keeps emails on this machine (OutboxMailer): useful locally with a copy of
 * the live database, because the stored SMTP settings would otherwise email real clients. Never
 * set it in production.
 */
namespace App\Core;

require_once __DIR__ . '/Env.php';

class Config {
    private static $defaults = [
        'DB_HOST' => ['127.0.0.1', 'string'],
        'DB_USER' => ['root', 'string'],
        'DB_PASS' => ['', 'string'],
        'DB_NAME' => ['parisbea_saas_master_db', 'string'],
        'SITE_URL' => ['http://localhost:3000', 'string'],
        'MAIL_DISABLED' => [false, 'bool'],
        'SMTP_HOST' => ['127.0.0.1', 'string'],
        'SMTP_PORT' => [587, 'int'],
        'SMTP_USER' => ['', 'string'],
        'SMTP_PASS' => ['', 'string'],
        'SMTP_FROM_NAME' => ['BizzFlow', 'string'],
        'SMTP_FROM_EMAIL' => ['no-reply@localhost', 'string'],
        // Custom domains: the host customers point their domain at (CNAME), and whether to check DNS (turn off only locally)
        'CUSTOM_DOMAIN_TARGET' => ['', 'string'],
        'CUSTOM_DOMAIN_DNS_CHECK' => [true, 'bool'],
    ];

    /**
     * Config::DB_HOST() -> value from .env, or the default above.
     * The unused $args keeps the signature valid for any call style.
     * @return mixed
     */
    public static function __callStatic($name, $_args) {
        if (!isset(self::$defaults[$name])) {
            throw new \BadMethodCallException("Unknown config key '$name'");
        }
        [$default, $kind] = self::$defaults[$name];
        if ($kind === 'bool') return Env::bool($name, (bool)$default);
        if ($kind === 'int') return Env::int($name, (int)$default);
        return Env::get($name, (string)$default);
    }
}
