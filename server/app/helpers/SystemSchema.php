<?php
/**
 * SystemSchema
 * Manages general system settings (Email, SMS, etc.)
 */
class SystemSchema {
    private static $done = false;

    private static function pdo() {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
        return new PDO($dsn, DB_USER, DB_PASS);
    }

    public static function ensure($force = false) {
        if (self::$done && !$force) return;
        self::$done = true;

        try {
            $pdo = self::pdo();
        } catch (Exception $e) {
            return;
        }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // 1. Create table for key-value settings
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS system_settings (
                setting_key VARCHAR(100) PRIMARY KEY,
                setting_value TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");

        // 2. Default SMTP and SMS keys
        $defaults = [
            'mail_host' => 'smtp.mailtrap.io',
            'mail_port' => '2525',
            'mail_user' => '',
            'mail_pass' => '',
            'mail_encryption' => 'tls',
            'mail_from_addr' => 'no-reply@servicebay.com',
            'mail_from_name' => 'BizFlow',
            'sms_gateway_url' => 'https://sms.send.lk/api/v3/sms/send',
            'sms_api_key' => '',
            'sms_sender_id' => 'BizFlow'
        ];

        foreach ($defaults as $key => $val) {
            $stmt = $pdo->prepare("INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES (:k, :v)");
            $stmt->execute([':k' => $key, ':v' => $val]);
        }
    }
}
