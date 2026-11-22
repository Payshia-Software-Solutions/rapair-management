<?php
/**
 * Env
 * Tiny .env loader (no Composer dependency). Reads server/.env once; Env::get() returns a value.
 * Blank entries behave like missing ones, so a default can still apply.
 *
 * Supports KEY=value and KEY="value with spaces", # comments, blank lines and basic escapes inside
 * double quotes. Values are NOT put into $_ENV / getenv(), so they cannot leak into child processes
 * or phpinfo(); always read them through Env::get().
 *
 * This server and the Nexus portal each have their own .env, so the same key names never clash.
 */
class Env {
    private static $values;
    private static $path;

    public static function load($path = null) {
        if (self::$values !== null) return;
        self::$values = [];
        self::$path = $path ?: dirname(__DIR__, 2) . '/.env';
        if (!is_readable(self::$path)) return;
        foreach (file(self::$path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = ltrim($line);
            if ($line === '' || $line[0] === '#') continue;
            if (!preg_match('/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/', $line, $m)) continue;
            $v = trim($m[2]);
            if ($v !== '' && ($v[0] === '"' || $v[0] === "'")) {
                $q = $v[0];
                $end = strrpos($v, $q);
                if ($end !== false && $end > 0) {
                    $inner = substr($v, 1, $end - 1);
                    if ($q === '"') $inner = str_replace(['\\n', '\\r', '\\t', '\\"', '\\\\'], ["\n", "\r", "\t", '"', '\\'], $inner);
                    $v = $inner;
                }
            } else {
                if (preg_match('/^(.*?)\s+#/', $v, $cm)) $v = $cm[1];
                $v = rtrim($v);
            }
            self::$values[$m[1]] = $v;
        }
    }

    public static function has() {
        self::load();
        return self::$values !== [];
    }

    /** Value, or $default when missing or blank. */
    public static function get($key, $default = null) {
        self::load();
        return isset(self::$values[$key]) && self::$values[$key] !== '' ? self::$values[$key] : $default;
    }

    public static function int($key, $default = 0) {
        $v = self::get($key);
        return $v === null ? (int)$default : (int)$v;
    }

    /** Stops with a clear message when a required key is missing (a half-configured server must not run). */
    public static function need($key) {
        $v = self::get($key);
        if ($v === null) {
            if (PHP_SAPI !== 'cli') {
                http_response_code(500);
                header('Content-Type: application/json');
            }
            echo json_encode(['status' => 'error', 'message' => "Server setup incomplete ($key is missing in .env)."]);
            exit(1);
        }
        return $v;
    }
}
