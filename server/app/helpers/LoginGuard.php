<?php
/**
 * LoginGuard - slows down password guessing on the sign-in endpoints.
 *
 * Failed attempts are counted per account (email) and per client IP in a rolling window:
 *   - 5 failures for one email within 15 minutes   -> that email is locked for 15 minutes
 *   - 20 failures from one IP within 15 minutes    -> that IP is blocked for 15 minutes
 * A successful sign-in clears the account's counter. While locked, even the right password is
 * refused, so a guesser learns nothing. Old rows are pruned as we go.
 *
 * Table (created on first use): login_attempts (scope 'email' | 'ip', subject, failed_at)
 */
class LoginGuard {
    const EMAIL_MAX = 5;
    const IP_MAX = 20;
    const WINDOW_MIN = 15;
    private static $ready = false;

    private static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        try {
            $db->query("CREATE TABLE IF NOT EXISTS login_attempts (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                scope VARCHAR(10) NOT NULL,
                subject VARCHAR(190) NOT NULL,
                failed_at DATETIME NOT NULL,
                INDEX idx_la_subject (scope, subject, failed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $db->execute();
        } catch (Exception $e) { error_log('LoginGuard schema: ' . $e->getMessage()); }
    }

    public static function clientIp() {
        return substr((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'), 0, 64);
    }

    private static function failures(Database $db, $scope, $subject) {
        $db->query("SELECT COUNT(*) AS n, MAX(failed_at) AS last FROM login_attempts
                    WHERE scope = :s AND subject = :sub AND failed_at > (NOW() - INTERVAL " . self::WINDOW_MIN . " MINUTE)");
        $db->bind(':s', $scope);
        $db->bind(':sub', $subject);
        return $db->single();
    }

    /**
     * Returns null when the attempt may go ahead, or a message saying how long to wait.
     * $context lets other sign-in forms (e.g. storefront customers) keep separate counters.
     */
    public static function blocked($email, $context = 'erp') {
        $db = new Database();
        self::ensure($db);
        try {
            foreach ([['email', self::EMAIL_MAX, $context . ':' . strtolower($email)], ['ip', self::IP_MAX, $context . ':' . self::clientIp()]] as [$scope, $max, $subject]) {
                $f = self::failures($db, $scope, $subject);
                if ($f && (int)$f->n >= $max) {
                    $left = strtotime($f->last) + self::WINDOW_MIN * 60 - time();
                    $mins = max(1, (int)ceil($left / 60));
                    return $scope === 'email'
                        ? "Too many failed sign-ins for this account. Try again in {$mins} min, or reset your password."
                        : "Too many failed sign-ins from this network. Try again in {$mins} min.";
                }
            }
        } catch (Exception $e) {
            error_log('LoginGuard check: ' . $e->getMessage()); // never lock everyone out because of a DB hiccup
        }
        return null;
    }

    public static function fail($email, $context = 'erp') {
        $db = new Database();
        self::ensure($db);
        try {
            foreach ([['email', $context . ':' . strtolower($email)], ['ip', $context . ':' . self::clientIp()]] as [$scope, $subject]) {
                $db->query("INSERT INTO login_attempts (scope, subject, failed_at) VALUES (:s, :sub, NOW())");
                $db->bind(':s', $scope);
                $db->bind(':sub', substr($subject, 0, 190));
                $db->execute();
            }
            if (mt_rand(1, 50) === 1) {
                $db->query("DELETE FROM login_attempts WHERE failed_at < (NOW() - INTERVAL 1 DAY)");
                $db->execute();
            }
        } catch (Exception $e) { error_log('LoginGuard fail: ' . $e->getMessage()); }
    }

    public static function succeed($email, $context = 'erp') {
        $db = new Database();
        self::ensure($db);
        try {
            $db->query("DELETE FROM login_attempts WHERE scope = 'email' AND subject = :sub");
            $db->bind(':sub', $context . ':' . strtolower($email));
            $db->execute();
        } catch (Exception $e) { error_log('LoginGuard succeed: ' . $e->getMessage()); }
    }
}
