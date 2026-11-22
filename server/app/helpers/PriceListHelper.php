<?php
/**
 * Selling price lists (Standard, Airport, Staff ...) assigned to locations.
 *
 * "Standard" is the item master Selling Price (no row). Every list has an optional parent
 * (null = Standard). An item's price in a list is:
 *    its own price in that list, if set
 *    else  parent's price  x (1 + adjust_percent/100), rounded to round_to
 * Lists are resolved up the parent chain (max 10 levels, loops ignored).
 */
class PriceListHelper {
    private static $cache = [];

    /** All active lists keyed by id. */
    public static function lists($db) {
        if (isset(self::$cache['lists'])) return self::$cache['lists'];
        $out = [];
        try {
            $db->query("SELECT * FROM price_lists WHERE is_active = 1");
            foreach ($db->resultSet() ?: [] as $l) $out[(int)$l->id] = $l;
        } catch (Exception $e) {}
        return self::$cache['lists'] = $out;
    }

    public static function locationListId($db, $locationId) {
        try {
            $db->query("SELECT price_list_id FROM service_locations WHERE id = :id");
            $db->bind(':id', (int)$locationId);
            $r = $db->single();
            return $r && $r->price_list_id ? (int)$r->price_list_id : null;
        } catch (Exception $e) { return null; }
    }

    /** list id -> chain [list, parent, grandparent ...] of active lists. */
    public static function chain($db, $listId) {
        $lists = self::lists($db);
        $chain = []; $seen = [];
        $id = (int)$listId;
        while ($id && isset($lists[$id]) && !isset($seen[$id]) && count($chain) < 10) {
            $seen[$id] = true;
            $chain[] = $lists[$id];
            $id = (int)($lists[$id]->parent_id ?? 0);
        }
        return $chain;
    }

    /** Explicit prices of the given lists for the given parts: [listId][partId] => price */
    public static function explicitPrices($db, array $listIds, array $partIds) {
        $out = [];
        $listIds = array_values(array_unique(array_filter(array_map('intval', $listIds))));
        $partIds = array_values(array_unique(array_filter(array_map('intval', $partIds))));
        if (!$listIds || !$partIds) return $out;
        $db->query("SELECT price_list_id, part_id, price FROM price_list_items
                    WHERE price_list_id IN (" . implode(',', $listIds) . ") AND part_id IN (" . implode(',', $partIds) . ")");
        foreach ($db->resultSet() ?: [] as $r) $out[(int)$r->price_list_id][(int)$r->part_id] = (float)$r->price;
        return $out;
    }

    public static function round($price, $roundTo) {
        $r = (float)$roundTo;
        if ($r <= 0) return round($price, 2);
        return round(round($price / $r) * $r, 2);
    }

    /** Price of one part in a chain (chain[0] = the list), given the Standard price. */
    public static function resolve(array $chain, array $explicit, $partId, $standardPrice) {
        $price = (float)$standardPrice;
        // walk from the top ancestor down to the list itself
        for ($i = count($chain) - 1; $i >= 0; $i--) {
            $l = $chain[$i];
            $lid = (int)$l->id;
            if (isset($explicit[$lid][(int)$partId])) {
                $price = $explicit[$lid][(int)$partId];
            } elseif ((float)$l->adjust_percent != 0) {
                $price = self::round($price * (1 + (float)$l->adjust_percent / 100), $l->round_to);
            }
        }
        return $price;
    }

    /**
     * Apply a location's price list to item rows (objects with id + price).
     * Adds default_price (Standard) and price_list_name; price becomes the location's price.
     */
    public static function applyToRows($db, $locationId, array $rows) {
        $listId = self::locationListId($db, $locationId);
        if (!$listId || !$rows) return $rows;
        $chain = self::chain($db, $listId);
        if (!$chain) return $rows;
        $explicit = self::explicitPrices($db, array_map(function ($l) { return $l->id; }, $chain), array_map(function ($r) { return $r->id; }, $rows));
        foreach ($rows as $r) {
            $r->default_price = $r->price;
            $r->price = self::resolve($chain, $explicit, (int)$r->id, (float)$r->price);
            $r->price_list_name = $chain[0]->name;
        }
        return $rows;
    }
}
