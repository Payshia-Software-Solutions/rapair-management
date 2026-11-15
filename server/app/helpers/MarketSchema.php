<?php
/**
 * MarketSchema
 * Multi-country selling: markets (country + currency + language + ERP location), currencies and
 * fixed per-market price lists. A market is plain data: adding a country needs no code change.
 */
class MarketSchema {
    private static $done = false;

    private static function pdo() {
        $host = defined('DB_HOST_OVERRIDE') ? DB_HOST_OVERRIDE : DB_HOST;
        $dsn = 'mysql:host=' . $host . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        return new PDO($dsn, DB_USER, DB_PASS);
    }

    private static function hasColumn($pdo, $table, $col) {
        $st = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $st->execute([$col]);
        return (bool)$st->fetch();
    }

    /** Install missing country currencies without overwriting shop rates or display settings. */
    public static function seedWorldCurrencies(?PDO $pdo = null): int {
        $pdo ??= self::pdo();
        $presets = json_decode(file_get_contents(__DIR__ . '/../../config/market-currencies.json'), true, 512, JSON_THROW_ON_ERROR);
        $existing = array_fill_keys($pdo->query('SELECT code FROM currencies')->fetchAll(PDO::FETCH_COLUMN), true);
        $missing = array_filter($presets, fn($preset) => !isset($existing[$preset[0]]));
        if (!$missing) return 0;

        $values = implode(', ', array_fill(0, count($missing), '(?, ?, ?, ?, 0)'));
        $insert = $pdo->prepare("
            INSERT INTO currencies (code, name, symbol, decimals, rate_to_base) VALUES $values
            ON DUPLICATE KEY UPDATE code = VALUES(code)
        ");
        $insert->execute(array_merge(...array_values($missing)));
        return $insert->rowCount();
    }

    public static function ensure($force = false) {
        if (!$force && !defined('FORCE_MIGRATIONS')) return;
        if (self::$done && !$force) return;
        self::$done = true;

        try { $pdo = self::pdo(); } catch (Exception $e) { return; }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Currencies. rate_to_base = how many base-currency units (LKR) one unit of this currency is worth.
        // Only used for the books (orders keep the rate they were placed at); prices themselves are fixed per market.
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS currencies (
                code CHAR(3) NOT NULL PRIMARY KEY,
                name VARCHAR(60) NOT NULL,
                symbol VARCHAR(8) NOT NULL,
                decimals TINYINT NOT NULL DEFAULT 2,
                rate_to_base DECIMAL(18,6) NOT NULL DEFAULT 1,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        $seed = $pdo->prepare("INSERT IGNORE INTO currencies (code, name, symbol, decimals, rate_to_base) VALUES (?,?,?,?,?)");
        foreach ([
            ['LKR', 'Sri Lankan Rupee', 'Rs', 2, 1],
            ['AUD', 'Australian Dollar', 'A$', 2, 0],
            ['GBP', 'Pound Sterling', '£', 2, 0],
            ['JPY', 'Japanese Yen', '¥', 0, 0],
            ['USD', 'US Dollar', '$', 2, 0],
            ['EUR', 'Euro', '€', 2, 0],
            ['AED', 'UAE Dirham', 'AED', 2, 0],
            ['SGD', 'Singapore Dollar', 'S$', 2, 0],
        ] as $row) $seed->execute($row);
        self::seedWorldCurrencies($pdo);

        // Markets
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS markets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(16) NOT NULL UNIQUE,            -- url segment, e.g. 'au', 'uk', 'jp' ('lk' for the home market)
                name VARCHAR(100) NOT NULL,                  -- shown in the country selector
                country_code CHAR(2) NOT NULL,               -- ISO 3166-1 alpha-2
                currency_code CHAR(3) NOT NULL,
                language_code VARCHAR(8) NOT NULL DEFAULT 'en',
                locale VARCHAR(16) NOT NULL DEFAULT 'en',    -- BCP 47 for number/date formatting and hreflang, e.g. en-AU
                location_id INT NOT NULL,                    -- ERP location: tax setup, storefront and payment settings, orders
                stock_location_id INT NULL,                  -- where availability is read from (defaults to location_id)
                uses_price_list TINYINT(1) NOT NULL DEFAULT 1, -- 1: only items with a price in this market are sold, at that price
                is_default TINYINT(1) NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                sort_order INT NOT NULL DEFAULT 0,
                created_by INT NULL,
                updated_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY idx_markets_location (location_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // Fixed prices per market. price is the final shelf price in the market's currency, using the same
        // inclusive/exclusive convention as the market location's storefront tax setting. compare_at is the optional struck-through price.
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS part_market_prices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                part_id INT NOT NULL,
                market_id INT NOT NULL,
                price DECIMAL(12,2) NOT NULL,
                compare_at_price DECIMAL(12,2) NULL,
                updated_by INT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_part_market (part_id, market_id),
                KEY idx_pmp_market (market_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        // A single API key may serve several markets when this flag is set (the site passes ?market=code).
        if (!self::hasColumn($pdo, 'api_clients', 'all_markets')) {
            $pdo->exec("ALTER TABLE api_clients ADD COLUMN all_markets TINYINT(1) NOT NULL DEFAULT 0 AFTER location_id");
        }

        // Orders remember the currency and market they were placed in, plus the rate to the base currency at that moment.
        if (self::hasColumn($pdo, 'online_orders', 'id')) {
            if (!self::hasColumn($pdo, 'online_orders', 'currency_code')) {
                $pdo->exec("ALTER TABLE online_orders ADD COLUMN currency_code CHAR(3) NULL");
            }
            if (!self::hasColumn($pdo, 'online_orders', 'exchange_rate')) {
                $pdo->exec("ALTER TABLE online_orders ADD COLUMN exchange_rate DECIMAL(18,6) NULL");
            }
            if (!self::hasColumn($pdo, 'online_orders', 'market_id')) {
                $pdo->exec("ALTER TABLE online_orders ADD COLUMN market_id INT NULL");
            }
        }

        // Checkout mode per market: 'online' (pay now) or 'quote' (order request; staff confirm shipping and payment).
        if (!self::hasColumn($pdo, 'markets', 'checkout_mode')) {
            $pdo->exec("ALTER TABLE markets ADD COLUMN checkout_mode VARCHAR(10) NOT NULL DEFAULT 'online'");
        }
        if (!self::hasColumn($pdo, 'markets', 'quote_notify_email')) {
            $pdo->exec("ALTER TABLE markets ADD COLUMN quote_notify_email VARCHAR(160) NULL");
        }
        if (!self::hasColumn($pdo, 'markets', 'quote_message')) {
            $pdo->exec("ALTER TABLE markets ADD COLUMN quote_message TEXT NULL");
        }

        // Homepage "Shop Our Best Selling Products" per market: comma-separated part ids in display order.
        // NULL = not set for this market yet, so the storefront falls back to the location's storefront setting.
        if (!self::hasColumn($pdo, 'markets', 'best_seller_ids')) {
            $pdo->exec("ALTER TABLE markets ADD COLUMN best_seller_ids TEXT NULL");
        }

        // Sale window on a price-list row: while active the shopper pays `price` and sees compare_at_price struck through;
        // outside the window compare_at_price (the regular price) is charged.
        if (!self::hasColumn($pdo, 'part_market_prices', 'sale_from')) {
            $pdo->exec("ALTER TABLE part_market_prices ADD COLUMN sale_from DATETIME NULL, ADD COLUMN sale_to DATETIME NULL");
        }

        // Quote orders: NULL = normal order; awaiting_quote -> quoted (staff set shipping and told the customer).
        if (self::hasColumn($pdo, 'online_orders', 'id')) {
            if (!self::hasColumn($pdo, 'online_orders', 'quote_status')) {
                $pdo->exec("ALTER TABLE online_orders ADD COLUMN quote_status VARCHAR(20) NULL, ADD COLUMN quote_note TEXT NULL");
            }
        }

        // Coupons can be limited to one market (NULL = all markets).
        if (self::hasColumn($pdo, 'coupons', 'id') && !self::hasColumn($pdo, 'coupons', 'market_id')) {
            $pdo->exec("ALTER TABLE coupons ADD COLUMN market_id INT NULL");
        }

        // Shipping zones can belong to one market (NULL = all markets).
        if (self::hasColumn($pdo, 'shipping_zones', 'id') && !self::hasColumn($pdo, 'shipping_zones', 'market_id')) {
            $pdo->exec("ALTER TABLE shipping_zones ADD COLUMN market_id INT NULL");
        }
    }
}
