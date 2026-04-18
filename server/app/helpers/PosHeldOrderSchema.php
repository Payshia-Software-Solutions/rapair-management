<?php
/**
 * PosHeldOrderSchema Helper
 * Manages tables for "Hold Bill" and KOT features.
 */
class PosHeldOrderSchema {
    private static $done = false;

    public static function ensure($force = false) {
        if (self::$done && !$force) return;
        self::$done = true;

        $db = new Database();
        $pdo = $db->getDb();

        // 1. pos_held_orders
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS pos_held_orders (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    location_id INT NOT NULL,
                    customer_id INT NOT NULL,
                    order_type ENUM('dine_in', 'take_away', 'retail') DEFAULT 'retail',
                    table_id INT NULL,
                    steward_id INT NULL,
                    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    tax_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    discount_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    grand_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
                    notes TEXT NULL,
                    created_by INT NULL,
                    updated_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_pho_location (location_id),
                    INDEX idx_pho_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
        } catch (Exception $e) {}

        // 2. pos_held_order_items
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS pos_held_order_items (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    held_order_id INT NOT NULL,
                    item_id INT NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    item_type ENUM('Part', 'Service', 'Other') DEFAULT 'Part',
                    quantity DECIMAL(12,3) NOT NULL DEFAULT 1.000,
                    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    line_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    is_kot_printed TINYINT(1) NOT NULL DEFAULT 0,
                    FOREIGN KEY (held_order_id) REFERENCES pos_held_orders(id) ON DELETE CASCADE,
                    INDEX idx_phoi_order (held_order_id),
                    INDEX idx_phoi_item (item_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            ");
        } catch (Exception $e) {}
    }
}
