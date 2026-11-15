<?php
/**
 * Bot and spam protection for public website forms (contact, reviews).
 * - Honeypot: a hidden field real people never fill. If it's filled, the submission is quietly dropped.
 * - Timing: forms submitted faster than a human could type are quietly dropped.
 * - Rate limit: a per-IP cap on submissions in a time window.
 * - Links are rejected in free text, the usual carrier for spam.
 */
class PublicFormGuard {
    const MIN_SECONDS = 3;

    public static function ip() {
        return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45);
    }

    private static function ensureSchema() {
        static $done = false;
        if ($done) return;
        $done = true;
        $db = new Database();
        $db->query("CREATE TABLE IF NOT EXISTS public_form_hits (
            id INT AUTO_INCREMENT PRIMARY KEY,
            form VARCHAR(32) NOT NULL,
            ip VARCHAR(45) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            KEY idx_public_form_hits (form, ip, created_at)
        ) ENGINE=InnoDB");
        $db->execute();
    }

    /**
     * Returns 'spam' when the form should be silently dropped (honeypot or too fast), otherwise null.
     * The caller still answers with a normal success message, so bots learn nothing.
     */
    public static function spamVerdict(array $data) {
        if (!empty($data['website'])) return 'spam'; // honeypot
        $started = (int)($data['started_at'] ?? 0); // ms timestamp set when the form was shown
        if ($started > 0 && (microtime(true) * 1000 - $started) < self::MIN_SECONDS * 1000) return 'spam';
        return null;
    }

    /**
     * Stops the request with 429 when this IP has already sent too many submissions for this form.
     * Only saved submissions count (see record()), so typos and validation errors don't lock people out.
     */
    public static function rateLimit($controller, $form, $max, $minutes) {
        self::ensureSchema();
        $ip = self::ip();
        $db = new Database();
        $db->query("SELECT COUNT(*) AS c FROM public_form_hits WHERE form = :form AND ip = :ip AND created_at > DATE_SUB(NOW(), INTERVAL " . (int)$minutes . " MINUTE)");
        $db->bind(':form', $form);
        $db->bind(':ip', $ip);
        $row = $db->single();
        if ((int)($row->c ?? 0) >= $max) {
            $controller->error('Too many submissions from your connection. Please try again later.', 429);
        }
    }

    /** Counts a saved submission towards this IP's limit. */
    public static function record($form) {
        self::ensureSchema();
        $db = new Database();
        $db->query("INSERT INTO public_form_hits (form, ip) VALUES (:form, :ip)");
        $db->bind(':form', $form);
        $db->bind(':ip', self::ip());
        $db->execute();
    }

    /** Plain text from a form: tags removed, trimmed, length capped. */
    public static function text($value, $max) {
        $clean = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)));
        return mb_substr($clean, 0, $max);
    }

    /** True when the text contains a link (common in spam). */
    public static function hasLink($value) {
        return (bool)preg_match('#https?://|www\.|\[url|<a\s#i', (string)$value);
    }
}
