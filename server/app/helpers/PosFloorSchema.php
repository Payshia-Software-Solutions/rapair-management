<?php
/**
 * PosFloorSchema - POS profiles and the restaurant floor plan.
 *
 *   service_locations.pos_profile   which POS screen the location uses ('classic' | 'restaurant' | ...)
 *   restaurant_areas                floors / areas of a location (Ground floor, Rooftop...)
 *   restaurant_tables + columns     area_id, position, size, rotation, shape, seats
 *   restaurant_layout_objects       walls, bar counter, doors... (drawing only, not sellable tables)
 *
 * Nothing runs on normal requests: run() tries the action and only when MySQL reports a missing
 * table (1146) or column (1054) it adds them and tries once more. So every workspace upgrades
 * itself the first time it uses the feature.
 */
class PosFloorSchema {
    // Same list as front-end/src/lib/pos-profiles.ts
    public const PROFILES = ['classic', 'restaurant', 'supermarket', 'mini', 'pharmacy', 'hardware', 'phone', 'workshop'];

    public static function run(Database $db, callable $fn) {
        try {
            return $fn();
        } catch (PDOException $e) {
            $code = (int)($e->errorInfo[1] ?? 0);
            if ($code !== 1146 && $code !== 1054) throw $e;
            self::ensure($db);
            return $fn();
        }
    }

    private static function hasColumn(Database $db, string $table, string $col): bool {
        // $table and $col are fixed names from this file, never user input
        $db->query("SHOW COLUMNS FROM `$table` LIKE '$col'");
        return (bool)$db->single();
    }

    public static function ensure(Database $db) {
        $add = function (string $table, array $cols) use ($db) {
            foreach ($cols as $col => $def) {
                try {
                    if (!self::hasColumn($db, $table, $col)) {
                        $db->query("ALTER TABLE `$table` ADD COLUMN `$col` $def");
                        $db->execute();
                    }
                } catch (Exception $e) { error_log("PosFloorSchema $table.$col: " . $e->getMessage()); }
            }
        };

        $add('service_locations', ['pos_profile' => "VARCHAR(30) NOT NULL DEFAULT 'classic'"]);

        try {
            $db->query("CREATE TABLE IF NOT EXISTS restaurant_areas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                location_id INT NOT NULL,
                name VARCHAR(60) NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                width INT NOT NULL DEFAULT 1200,
                height INT NOT NULL DEFAULT 800,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ra_location (location_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $db->execute();
            $db->query("CREATE TABLE IF NOT EXISTS restaurant_layout_objects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                area_id INT NOT NULL,
                kind VARCHAR(20) NOT NULL DEFAULT 'wall',
                label VARCHAR(60) NULL,
                pos_x INT NOT NULL DEFAULT 0,
                pos_y INT NOT NULL DEFAULT 0,
                width INT NOT NULL DEFAULT 120,
                height INT NOT NULL DEFAULT 12,
                rotation INT NOT NULL DEFAULT 0,
                INDEX idx_rlo_area (area_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $db->execute();
        } catch (Exception $e) { error_log('PosFloorSchema tables: ' . $e->getMessage()); }

        $add('restaurant_tables', [
            'area_id'  => "INT NULL",
            'pos_x'    => "INT NULL",
            'pos_y'    => "INT NULL",
            'width'    => "INT NOT NULL DEFAULT 90",
            'height'   => "INT NOT NULL DEFAULT 90",
            'rotation' => "INT NOT NULL DEFAULT 0",
            'shape'    => "VARCHAR(10) NOT NULL DEFAULT 'square'",
            'seats'    => "INT NOT NULL DEFAULT 4",
            // Merged for a group: the main table this one is joined to (its bill covers both)
            'joined_to' => "INT NULL",
        ]);
    }
}
