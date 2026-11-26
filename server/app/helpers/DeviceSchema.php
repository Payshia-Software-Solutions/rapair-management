<?php
/**
 * Push-notification device tokens (see helpers/PushHelper.php, controllers/DeviceController.php).
 * Created on first use, so no manual migration is needed.
 *
 *   device_tokens   one row per FCM token: which user it belongs to, which app, platform
 */
class DeviceSchema {
    private static $done = false;

    public static function ensure() {
        if (self::$done) return;
        self::$done = true;
        $pdo = (new Database())->getDb();
        if ($pdo->query("SHOW TABLES LIKE 'device_tokens'")->fetchColumn()) return;

        $pdo->exec("CREATE TABLE IF NOT EXISTS device_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token VARCHAR(255) NOT NULL,
            app VARCHAR(40) NOT NULL DEFAULT 'mgmt',
            platform VARCHAR(20) NOT NULL DEFAULT 'android',
            device_name VARCHAR(120) NULL,
            last_seen_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_dt_token (token),
            INDEX idx_dt_user (user_id)
        )");
    }
}
