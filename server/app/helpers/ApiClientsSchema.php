<?php
/**
 * ApiClientsSchema
 * Manages the table for domain-specific API keys.
 */
class ApiClientsSchema {
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

        // API Clients table
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS api_clients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                client_name VARCHAR(100) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                api_key VARCHAR(100) NOT NULL UNIQUE,
                is_active TINYINT(1) DEFAULT 1,
                created_by INT NULL,
                updated_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");
    }
}
