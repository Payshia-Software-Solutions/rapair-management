<?php
/**
 * Newsletter subscribers (e-commerce). Separate from customers: a subscriber only needs an email,
 * and storing opt-in here means campaigns reach people who actually asked for them.
 */
class SubscriberSchema {
    private static $done = false;

    public static function ensure() {
        if (self::$done) return;
        self::$done = true;

        $db = new Database();
        $db->query("CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(160) NOT NULL,
            name VARCHAR(120) NULL,
            source VARCHAR(40) NOT NULL DEFAULT 'Website',
            status ENUM('Subscribed', 'Unsubscribed') NOT NULL DEFAULT 'Subscribed',
            location_id INT NULL,
            customer_id INT NULL,
            unsubscribe_token CHAR(40) NOT NULL,
            ip_address VARCHAR(45) NULL,
            subscribed_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
            unsubscribed_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_subscriber_email (email),
            UNIQUE KEY uq_subscriber_token (unsubscribe_token),
            KEY idx_subscriber_status (status)
        ) ENGINE=InnoDB");
        $db->execute();
    }
}
