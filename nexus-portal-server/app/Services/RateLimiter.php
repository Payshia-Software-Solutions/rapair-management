<?php
namespace App\Services;

use App\Core\Database;

/**
 * Fixed-window rate limits kept in the master database (works on shared hosting, no Redis).
 *
 *   RateLimiter::tooMany('login-ip:' . RateLimiter::ip(), 20, 900)   // true when over the limit
 *   RateLimiter::hit('login-ip:' . RateLimiter::ip(), 900)            // count one attempt
 *   RateLimiter::clear('login-user:' . $username)                    // e.g. after a good login
 *
 * Buckets are hashed, so emails and usernames are not stored in clear. The table creates itself.
 * If the database is unavailable the limiter allows the request (it never locks everyone out).
 */
class RateLimiter {
    private static $ready = false;

    /** Client IP. REMOTE_ADDR only: X-Forwarded-For is set by the client and cannot be trusted here. */
    public static function ip() {
        return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    }

    /** True when the bucket already has $max hits in the current window. Does not count a hit. */
    public static function tooMany(string $bucket, int $max, int $window): bool {
        $row = self::row($bucket, $window);
        return $row !== null && (int)$row->hits >= $max;
    }

    /** Seconds until the bucket's window ends (for a Retry-After header). */
    public static function retryAfter(string $bucket, int $window): int {
        $row = self::row($bucket, $window);
        return $row ? max(1, $window - (time() - strtotime($row->window_start))) : 0;
    }

    /** Counts one hit; a window older than $window seconds starts over. */
    public static function hit(string $bucket, int $window): void {
        try {
            $db = self::db();
            $db->query("INSERT INTO saas_rate_limits (bucket, hits, window_start) VALUES (:b, 1, NOW())
                        ON DUPLICATE KEY UPDATE
                          hits = IF(window_start < NOW() - INTERVAL :w SECOND, 1, hits + 1),
                          window_start = IF(window_start < NOW() - INTERVAL :w2 SECOND, NOW(), window_start)");
            $db->bind(':b', self::key($bucket));
            $db->bind(':w', $window);
            $db->bind(':w2', $window);
            $db->execute();
            if (random_int(1, 200) === 1) { // occasional cleanup of old windows
                $db->query("DELETE FROM saas_rate_limits WHERE window_start < NOW() - INTERVAL 1 DAY");
                $db->execute();
            }
        } catch (\Throwable $e) {
            error_log('RateLimiter: ' . $e->getMessage());
        }
    }

    public static function clear(string $bucket): void {
        try {
            $db = self::db();
            $db->query("DELETE FROM saas_rate_limits WHERE bucket = :b");
            $db->bind(':b', self::key($bucket));
            $db->execute();
        } catch (\Throwable $e) {
            error_log('RateLimiter: ' . $e->getMessage());
        }
    }

    /** Counts a hit and reports whether the limit is now exceeded (for endpoints where every call counts). */
    public static function attempt(string $bucket, int $max, int $window): bool {
        if (self::tooMany($bucket, $max, $window)) return false;
        self::hit($bucket, $window);
        return true;
    }

    private static function row(string $bucket, int $window) {
        try {
            $db = self::db();
            $db->query("SELECT hits, window_start FROM saas_rate_limits
                        WHERE bucket = :b AND window_start >= NOW() - INTERVAL :w SECOND");
            $db->bind(':b', self::key($bucket));
            $db->bind(':w', $window);
            return $db->single() ?: null;
        } catch (\Throwable $e) {
            error_log('RateLimiter: ' . $e->getMessage());
            return null;
        }
    }

    private static function key(string $bucket): string {
        return hash('sha256', $bucket);
    }

    private static function db(): Database {
        $db = new Database();
        if (!self::$ready) {
            $db->query("CREATE TABLE IF NOT EXISTS saas_rate_limits (
                          bucket CHAR(64) NOT NULL PRIMARY KEY,
                          hits INT NOT NULL DEFAULT 0,
                          window_start DATETIME NOT NULL,
                          KEY idx_window (window_start)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $db->execute();
            self::$ready = true;
        }
        return $db;
    }
}
