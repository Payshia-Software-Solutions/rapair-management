<?php
/**
 * Export the website (online) products and e-commerce settings to an importable .sql file.
 *
 * Exports:
 *   - parts WHERE is_online = 1, plus their images, attributes, market prices and collection links
 *   - lookup tables the products point to (categories, brands, collections, units, attributes, taxes...)
 *   - storefront / e-commerce settings (settings, menus, media, markets, coupons, promotions, shipping)
 *
 * The output uses CREATE TABLE IF NOT EXISTS + INSERT ... ON DUPLICATE KEY UPDATE,
 * so importing it twice (or into a DB that already has some rows) is safe. Nothing is deleted.
 *
 * Run (CLI):      php tools/export_web_products.php > web_products.sql
 * Run (browser):  set EXPORT_KEY below, upload, open /tools/export_web_products.php?key=YOUR_KEY
 *                 then DELETE this file from the server.
 * Import:         phpMyAdmin -> target DB -> Import -> web_products.sql
 */

const EXPORT_KEY = ''; // browser access is disabled while this is empty

if (PHP_SAPI !== 'cli') {
    if (EXPORT_KEY === '' || !hash_equals(EXPORT_KEY, (string)($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit('Forbidden');
    }
    header('Content-Type: application/sql; charset=utf-8');
    header('Content-Disposition: attachment; filename="web_products_' . date('Ymd_His') . '.sql"');
}

require_once __DIR__ . '/../config/config.php';

$host = defined('DB_HOST_OVERRIDE') ? DB_HOST_OVERRIDE : DB_HOST;
$pdo = new PDO("mysql:host=$host;dbname=" . DB_NAME . ';charset=utf8mb4', DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

$online = 'SELECT id FROM parts WHERE is_online = 1';

// table => WHERE clause (null = whole table)
$tables = [
    // products
    'parts'                 => 'is_online = 1',
    'part_images'           => "part_id IN ($online)",
    'part_attribute_groups' => "part_id IN ($online)",
    'part_attribute_values' => "part_id IN ($online)",
    'part_market_prices'    => "part_id IN ($online)",
    'parts_collections'     => "part_id IN ($online)",
    // lookups the products reference
    'item_categories'  => null,
    'item_departments' => null,
    'item_sections'    => null,
    'brands'           => null,
    'collections'      => null,
    'units'            => null,
    'attribute_groups' => null,
    'attributes'       => null,
    'taxes'            => null,
    // e-commerce settings
    'storefront_settings' => null,
    'storefront_menus'    => null,
    'marketing_media'     => null,
    'currencies'          => null,
    'markets'             => null,
    'coupons'             => null,
    'promotions'          => null,
    'promotion_conditions'=> null,
    'promotion_benefits'  => null,
    'shipping_providers'  => null,
    'shipping_carriers'   => null,
];

$existing = array_flip($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN));

$out = fopen('php://output', 'w');
fwrite($out, "-- Web products + e-commerce settings export\n");
fwrite($out, '-- Source DB: ' . DB_NAME . '   Generated: ' . date('Y-m-d H:i:s') . "\n\n");
fwrite($out, "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n\n");

$summary = [];
foreach ($tables as $table => $where) {
    if (!isset($existing[$table])) {
        $summary[] = "$table: skipped (table not found)";
        continue;
    }

    $create = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
    $create = preg_replace('/^CREATE TABLE /', 'CREATE TABLE IF NOT EXISTS ', $create);
    fwrite($out, "-- ----- $table -----\n$create;\n\n");

    $stmt = $pdo->query("SELECT * FROM `$table`" . ($where ? " WHERE $where" : ''));
    $count = 0;
    $cols = null;
    $batch = [];
    $flush = function () use (&$batch, &$cols, $out, $table) {
        if (!$batch) return;
        $colList = implode(', ', array_map(fn($c) => "`$c`", $cols));
        $update = implode(', ', array_map(fn($c) => "`$c` = VALUES(`$c`)", $cols));
        fwrite($out, "INSERT INTO `$table` ($colList) VALUES\n" . implode(",\n", $batch) . "\nON DUPLICATE KEY UPDATE $update;\n");
        $batch = [];
    };
    while ($row = $stmt->fetch()) {
        $cols ??= array_keys($row);
        $batch[] = '(' . implode(', ', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote((string)$v), $row)) . ')';
        $count++;
        if (count($batch) >= 200) $flush();
    }
    $flush();
    fwrite($out, "\n");
    $summary[] = "$table: $count rows";
}

fwrite($out, "SET FOREIGN_KEY_CHECKS = 1;\n\n-- Summary\n-- " . implode("\n-- ", $summary) . "\n");
fclose($out);

if (PHP_SAPI === 'cli') {
    fwrite(STDERR, implode("\n", $summary) . "\n");
}
