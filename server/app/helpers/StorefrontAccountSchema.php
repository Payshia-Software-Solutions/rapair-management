<?php

class StorefrontAccountSchema {
    private static $billingReady = false;

    public static function ensureBilling(Database $db): void {
        if (self::$billingReady) return;
        $db->query("SHOW COLUMNS FROM customers LIKE 'storefront_billing'");
        if (!$db->single()) {
            $db->query("ALTER TABLE customers ADD COLUMN IF NOT EXISTS storefront_billing TEXT NULL");
            $db->execute();
        }
        self::$billingReady = true;
    }

    public static function ensureWishlist(Database $db): void {
        $db->query("
            CREATE TABLE IF NOT EXISTS storefront_wishlist (
                customer_id INT NOT NULL,
                part_id INT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (customer_id, part_id),
                FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
            ) ENGINE=InnoDB
        ");
        $db->execute();
    }
}
