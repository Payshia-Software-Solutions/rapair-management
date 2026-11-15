<?php
/**
 * Market model: countries the store sells in, their currencies and fixed price lists.
 */
class Market extends Model {
    public function __construct() {
        parent::__construct();
        require_once __DIR__ . '/../helpers/MarketSchema.php';
        MarketSchema::ensure();
    }

    private function baseSelect() {
        return "SELECT m.*, c.name AS currency_name, c.symbol AS currency_symbol, c.decimals AS currency_decimals,
                       c.rate_to_base AS currency_rate_to_base, sl.name AS location_name
                FROM markets m
                LEFT JOIN currencies c ON c.code = m.currency_code
                LEFT JOIN service_locations sl ON sl.id = m.location_id";
    }

    public function listActive() {
        $this->db->query($this->baseSelect() . " WHERE m.is_active = 1 ORDER BY m.is_default DESC, m.sort_order ASC, m.name ASC");
        return $this->db->resultSet();
    }

    public function listAll() {
        $this->db->query($this->baseSelect() . " ORDER BY m.is_default DESC, m.sort_order ASC, m.name ASC");
        return $this->db->resultSet();
    }

    public function getByCode($code) {
        $this->db->query($this->baseSelect() . " WHERE m.code = :code LIMIT 1");
        $this->db->bind(':code', strtolower(trim((string)$code)));
        return $this->db->single();
    }

    public function getById($id) {
        $this->db->query($this->baseSelect() . " WHERE m.id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    /** The active market bound to an ERP location (the home market when several share it). */
    public function getByLocation($locationId) {
        $this->db->query($this->baseSelect() . " WHERE m.location_id = :loc AND m.is_active = 1 ORDER BY m.is_default DESC, m.id ASC LIMIT 1");
        $this->db->bind(':loc', (int)$locationId);
        return $this->db->single();
    }

    /**
     * Price list of one market as part_id => [price, compare_at].
     */
    public function priceMap($marketId) {
        $this->db->query("SELECT part_id, price, compare_at_price, sale_from, sale_to FROM part_market_prices WHERE market_id = :m");
        $this->db->bind(':m', (int)$marketId);
        $map = [];
        foreach ($this->db->resultSet() as $r) {
            $map[(int)$r->part_id] = self::effective($r);
        }
        return $map;
    }

    /**
     * [price to charge, compare-at to show struck through | null] for a price row, honouring its sale window.
     * compare_at_price is the regular price: outside the sale window it is charged and nothing is struck through.
     */
    public static function effective($r) {
        $price = (float)$r->price;
        $cmp = $r->compare_at_price !== null ? (float)$r->compare_at_price : null;
        if ($cmp === null || $cmp <= $price) return [$price, null];
        $now = date('Y-m-d H:i:s');
        $active = (empty($r->sale_from) || $r->sale_from <= $now) && (empty($r->sale_to) || $r->sale_to >= $now);
        return $active ? [$price, $cmp] : [$cmp, null];
    }

    public function getPrice($marketId, $partId) {
        $this->db->query("SELECT price, compare_at_price, sale_from, sale_to FROM part_market_prices WHERE market_id = :m AND part_id = :p LIMIT 1");
        $this->db->bind(':m', (int)$marketId);
        $this->db->bind(':p', (int)$partId);
        $r = $this->db->single();
        return $r ? self::effective($r) : null;
    }

    public function setPrice($marketId, $partId, $price, $compareAt = null, $userId = null, $saleFrom = null, $saleTo = null) {
        $this->db->query("
            INSERT INTO part_market_prices (part_id, market_id, price, compare_at_price, sale_from, sale_to, updated_by)
            VALUES (:p, :m, :price, :cmp, :sf, :st, :u)
            ON DUPLICATE KEY UPDATE price = VALUES(price), compare_at_price = VALUES(compare_at_price),
                sale_from = VALUES(sale_from), sale_to = VALUES(sale_to), updated_by = VALUES(updated_by)
        ");
        $this->db->bind(':sf', $saleFrom ?: null);
        $this->db->bind(':st', $saleTo ?: null);
        $this->db->bind(':p', (int)$partId);
        $this->db->bind(':m', (int)$marketId);
        $this->db->bind(':price', round((float)$price, 2));
        $this->db->bind(':cmp', $compareAt === null || $compareAt === '' ? null : round((float)$compareAt, 2));
        $this->db->bind(':u', $userId);
        return $this->db->execute();
    }

    public function deletePrice($marketId, $partId) {
        $this->db->query("DELETE FROM part_market_prices WHERE market_id = :m AND part_id = :p");
        $this->db->bind(':m', (int)$marketId);
        $this->db->bind(':p', (int)$partId);
        return $this->db->execute();
    }

    public function getCurrency($code) {
        $this->db->query("SELECT * FROM currencies WHERE code = :c LIMIT 1");
        $this->db->bind(':c', strtoupper((string)$code));
        return $this->db->single();
    }
}
