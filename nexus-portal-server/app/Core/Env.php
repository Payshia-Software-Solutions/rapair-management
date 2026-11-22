<?php
/**
 * Env
 * Tiny .env loader (no Composer dependency). Loads nexus-portal-server/.env once, then Env::get()
 * returns a value. Blank entries behave like missing ones, so a default can still apply.
 *
 * Supports: KEY=value and KEY="value with spaces", # comments, blank lines, and basic escapes
 * (\n, \", \\) inside double-quoted values. Keys matching [A-Za-z_][A-Za-z0-9_]* only.
 * Lines that don't match are ignored (no crash). Values are NOT written to $_ENV / getenv()
 * to avoid leaking secrets into shell_exec'd children; call Env::get() instead.
 */
namespace App\Core;

class Env {
    private static $values;
    private static $loaded = false;
    private static $path;

    public static function load($path = null) {
        if (self::$loaded) return;
        self::$loaded = true;
        self::$path = $path ?: dirname(__DIR__, 2) . '/.env';
        self::$values = [];
        if (!is_readable(self::$path)) return;
        foreach (file(self::$path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = ltrim($line);
            if ($line === '' || $line[0] === '#') continue;
            if (!preg_match('/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/', $line, $m)) continue;
            $k = $m[1];
            $v = trim($m[2]);
            if ($v !== '' && ($v[0] === '"' || $v[0] === "'")) {
                $q = $v[0];
                $end = strrpos($v, $q);
                if ($end !== false && $end > 0) {
                    $inner = substr($v, 1, $end - 1);
                    if ($q === '"') {
                        $inner = str_replace(['\\n', '\\r', '\\t', '\\"', '\\\\'], ["\n", "\r", "\t", '"', '\\'], $inner);
                    }
                    $v = $inner;
                }
            } else {
                // Strip an unquoted trailing " # comment"
                if (preg_match('/^(.*?)\s+#/', $v, $cm)) $v = $cm[1];
                $v = rtrim($v);
            }
            self::$values[$k] = $v;
        }
    }

    /** $key -> string. Blank or missing returns $default. */
    public static function get($key, $default = null) {
        self::load();
        return isset(self::$values[$key]) && self::$values[$key] !== '' ? self::$values[$key] : $default;
    }

    public static function int($key, $default = 0) {
        $v = self::get($key, null);
        return $v === null ? (int)$default : (int)$v;
    }

    public static function bool($key, $default = false) {
        $v = self::get($key, null);
        if ($v === null) return (bool)$default;
        return in_array(strtolower(trim($v)), ['1', 'true', 'yes', 'on'], true);
    }

    /** Where the loader looked (for error messages). */
    public static function path() { self::load(); return self::$path; }

    /** For tests. */
    public static function reset() { self::$values = null; self::$loaded = false; }
}
