<?php
/**
 * Promotion (Marketing & Discounts) Model
 *
 * One engine for every channel (POS, invoices, storefront). The server is the source of truth:
 * the POS shows what this returns, and invoice creation recomputes it before saving.
 *
 * When an offer runs:
 *   start_date / end_date   calendar range (inclusive)
 *   start_time / end_time   daily window, e.g. 17:00-19:00 (may cross midnight, 22:00-02:00)
 *   days_of_week            "1,2,3,4,5,6,7" ISO days (1 = Monday); empty = every day
 *   applicable_locations    JSON list of location ids; empty = all
 *   promo_code              when set, the offer only applies when the cashier enters this code
 *   usage_limit / used_count  0 = unlimited
 *   max_discount            cap per bill; 0 = no cap
 *
 * What it discounts: a benefit's target_items / target_categories. With no target, an ItemList
 * or CollectionList condition is the target (so "10% off item X" only discounts item X). With
 * neither, the whole bill.
 *
 * Cart items: [{ id|item_id, quantity, unit_price, discount (per unit), is_reward? }]
 * Prices are what the customer sees (display prices). Context: promo_code, order_type, now.
 */
class Promotion extends Model {
    private $table = 'promotions';
    private $catCache = [];

    public function __construct() {
        parent::__construct();
        require_once __DIR__ . '/../helpers/PromotionSchema.php';
        PromotionSchema::ensure();
        PromotionSchema::upgrade();
    }

    // ------------------------------------------------------------------ reading

    /** Every promotion (admin list), newest first. */
    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY is_active DESC, priority DESC, id DESC");
        $rows = $this->db->resultSet();
        foreach ($rows as $promo) {
            $promo->conditions = $this->getConditions($promo->id);
            $promo->benefits = $this->getBenefits($promo->id);
            $this->enrichPromotionDetails($promo);
            $promo->live_now = $this->scheduleReason($promo, null, time()) === null;
        }
        return $rows;
    }

    /**
     * Promotions running right now at a location (date, time window, weekday, usage limit).
     * Code-only offers are included and marked requires_code, so the POS can show them.
     */
    public function getActivePromotions($locationId = null, $now = null) {
        $now = $now ?: time();
        $today = date('Y-m-d', $now);
        $sql = "
            SELECT * FROM {$this->table}
            WHERE is_active = 1
            AND (start_date IS NULL OR start_date <= :today)
            AND (end_date IS NULL OR end_date >= :today)
        ";
        if ($locationId) {
            $sql .= " AND (applicable_locations IS NULL OR applicable_locations = '' OR applicable_locations = '[]' OR JSON_CONTAINS(applicable_locations, :locId) OR JSON_CONTAINS(applicable_locations, :locIdStr)) ";
        }
        $sql .= " ORDER BY priority DESC, id DESC";

        $this->db->query($sql);
        $this->db->bind(':today', $today);
        if ($locationId) {
            $this->db->bind(':locId', json_encode((int)$locationId));
            $this->db->bind(':locIdStr', json_encode((string)$locationId));
        }

        $out = [];
        foreach ($this->db->resultSet() as $promo) {
            if ($this->scheduleReason($promo, $locationId, $now) !== null) continue;
            $promo->conditions = $this->getConditions($promo->id);
            $promo->benefits = $this->getBenefits($promo->id);
            $promo->requires_code = !empty($promo->promo_code);
            unset($promo->promo_code); // never send codes to the till
            $this->enrichPromotionDetails($promo);
            $promo->item_ids = $this->promotedItemIds($promo);
            $promo->category_ids = $this->promotedCategoryIds($promo);
            $out[] = $promo;
        }
        return $out;
    }

    public function getPromotion($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        $promo = $this->db->single();
        if ($promo) {
            $promo->conditions = $this->getConditions($promo->id);
            $promo->benefits = $this->getBenefits($promo->id);
        }
        return $promo;
    }

    private function getConditions($promoId) {
        $this->db->query("SELECT * FROM promotion_conditions WHERE promotion_id = :pid");
        $this->db->bind(':pid', $promoId);
        return $this->db->resultSet();
    }

    private function getBenefits($promoId) {
        $this->db->query("SELECT * FROM promotion_benefits WHERE promotion_id = :pid");
        $this->db->bind(':pid', $promoId);
        return $this->db->resultSet();
    }

    private static function ids($json) {
        if (is_array($json)) return array_values(array_filter(array_map('intval', $json)));
        $v = json_decode((string)($json ?? ''), true);
        return is_array($v) ? array_values(array_filter(array_map('intval', $v))) : [];
    }

    /** Items a promotion advertises (for "OFFER" badges on the POS grid). */
    private function promotedItemIds($promo) {
        $ids = [];
        foreach ($promo->conditions as $c) if ($c->condition_type === 'ItemList') $ids = array_merge($ids, self::ids($c->requirement_value));
        foreach ($promo->benefits as $b) {
            $ids = array_merge($ids, self::ids($b->target_items ?? null), self::ids($b->trigger_items ?? null), self::ids($b->reward_items ?? null));
        }
        return array_values(array_unique($ids));
    }

    private function promotedCategoryIds($promo) {
        $ids = [];
        foreach ($promo->conditions as $c) if ($c->condition_type === 'CollectionList') $ids = array_merge($ids, self::ids($c->requirement_value));
        foreach ($promo->benefits as $b) $ids = array_merge($ids, self::ids($b->target_categories ?? null));
        return array_values(array_unique($ids));
    }

    private function enrichPromotionDetails(&$promo) {
        $partIds = [];
        $collectionIds = [];
        foreach ($promo->conditions as $cond) {
            if ($cond->condition_type === 'ItemList') $partIds = array_merge($partIds, self::ids($cond->requirement_value));
            if ($cond->condition_type === 'CollectionList') $collectionIds = array_merge($collectionIds, self::ids($cond->requirement_value));
        }
        foreach ($promo->benefits as $ben) {
            if ($ben->benefit_type === 'FreeItem' && $ben->benefit_value > 0) $partIds[] = (int)$ben->benefit_value;
            $partIds = array_merge($partIds, self::ids($ben->trigger_items ?? null), self::ids($ben->reward_items ?? null), self::ids($ben->target_items ?? null));
            $collectionIds = array_merge($collectionIds, self::ids($ben->target_categories ?? null));
        }
        $partNames = $this->fetchNames('parts', 'part_name', array_unique($partIds));
        $collectionNames = $this->fetchNames('collections', 'name', array_unique($collectionIds));

        foreach ($promo->conditions as &$cond) {
            if ($cond->condition_type === 'ItemList') $cond->item_names = array_intersect_key($partNames, array_flip(self::ids($cond->requirement_value)));
            if ($cond->condition_type === 'CollectionList') $cond->collection_names = array_intersect_key($collectionNames, array_flip(self::ids($cond->requirement_value)));
        }
        foreach ($promo->benefits as &$ben) {
            if ($ben->benefit_type === 'FreeItem') $ben->item_name = $partNames[(int)$ben->benefit_value] ?? 'Unknown Item';
            $ben->trigger_item_names = array_intersect_key($partNames, array_flip(self::ids($ben->trigger_items ?? null)));
            $ben->reward_item_names = array_intersect_key($partNames, array_flip(self::ids($ben->reward_items ?? null)));
            $ben->target_item_names = array_intersect_key($partNames, array_flip(self::ids($ben->target_items ?? null)));
            $ben->target_category_names = array_intersect_key($collectionNames, array_flip(self::ids($ben->target_categories ?? null)));
        }
    }

    private function fetchNames($table, $col, $ids) {
        $ids = array_values(array_filter(array_map('intval', $ids)));
        if (empty($ids)) return [];
        $this->db->query("SELECT id, {$col} AS n FROM {$table} WHERE id IN (" . implode(',', $ids) . ")");
        $map = [];
        foreach ($this->db->resultSet() as $r) $map[(int)$r->id] = $r->n;
        return $map;
    }

    // ------------------------------------------------------------------ eligibility

    /** Why the offer isn't running right now (dates, hours, weekday, location, usage), or null. */
    private function scheduleReason($promo, $locationId, $now) {
        if (!(int)$promo->is_active) return "Promotion '{$promo->name}' is not active.";
        $today = date('Y-m-d', $now);
        if (!empty($promo->start_date) && $promo->start_date > $today) return "Promotion '{$promo->name}' has not started yet.";
        if (!empty($promo->end_date) && $promo->end_date < $today) return "Promotion '{$promo->name}' has expired.";

        $days = trim((string)($promo->days_of_week ?? ''));
        if ($days !== '') {
            $allowed = array_map('intval', explode(',', $days));
            if (!in_array((int)date('N', $now), $allowed, true)) return "Promotion '{$promo->name}' does not run today.";
        }

        $st = $promo->start_time ?? null;
        $et = $promo->end_time ?? null;
        if ($st || $et) {
            $t = date('H:i:s', $now);
            $st = $st ?: '00:00:00';
            $et = $et ?: '23:59:59';
            $inside = $st <= $et ? ($t >= $st && $t <= $et) : ($t >= $st || $t <= $et); // crosses midnight
            if (!$inside) return "Promotion '{$promo->name}' runs " . substr($st, 0, 5) . '-' . substr($et, 0, 5) . ' only.';
        }

        if ($locationId && !empty($promo->applicable_locations)) {
            $locs = json_decode($promo->applicable_locations, true) ?: [];
            if ($locs && !in_array((string)$locationId, array_map('strval', $locs), true)) {
                return "Promotion '{$promo->name}' is not applicable at this location.";
            }
        }

        $limit = (int)($promo->usage_limit ?? 0);
        if ($limit > 0 && (int)($promo->used_count ?? 0) >= $limit) return "Promotion '{$promo->name}' has been fully used.";
        return null;
    }

    /** Category (collection) ids for each part id in the cart. */
    private function categoriesFor(array $partIds) {
        $need = array_values(array_diff(array_unique(array_filter(array_map('intval', $partIds))), array_keys($this->catCache)));
        if ($need) {
            foreach ($need as $id) $this->catCache[$id] = [];
            $list = implode(',', $need);
            try {
                $this->db->query("SELECT part_id, collection_id FROM parts_collections WHERE part_id IN ($list)");
                foreach ($this->db->resultSet() as $r) $this->catCache[(int)$r->part_id][] = (int)$r->collection_id;
            } catch (Exception $e) {}
        }
        $out = [];
        foreach ($partIds as $id) $out[(int)$id] = $this->catCache[(int)$id] ?? [];
        return $out;
    }

    /** Cart lines as plain arrays: id, qty, price (per unit), net (line after line discount). */
    private function lines($cartItems) {
        $out = [];
        foreach ($cartItems as $i) {
            $i = (object)$i;
            if (!empty($i->is_reward)) continue; // reward lines are already free
            if (!empty($i->is_comp) || !empty($i->is_complimentary)) continue;
            $qty = (float)($i->quantity ?? 0);
            if ($qty <= 0) continue;
            $price = (float)($i->display_unit_price ?? $i->unit_price ?? 0);
            $disc = (float)($i->display_discount ?? $i->discount ?? 0);
            $out[] = [
                'id' => (int)($i->item_id ?? $i->id ?? 0),
                'qty' => $qty,
                'price' => $price,
                'unit_net' => max(0, $price - $disc),
                'net' => max(0, $qty * ($price - $disc)),
            ];
        }
        $cats = $this->categoriesFor(array_column($out, 'id'));
        foreach ($out as &$l) $l['cats'] = $cats[$l['id']] ?? [];
        return $out;
    }

    private static function lineMatches($l, array $items, array $cats) {
        if (!$items && !$cats) return true;
        if ($items && in_array($l['id'], $items, true)) return true;
        if ($cats && array_intersect($cats, $l['cats'])) return true;
        return false;
    }

    /** Why the cart doesn't meet the conditions, or null when it does. */
    private function conditionReason($promo, array $lines, $subtotal, $bankId, $cardCategory, array $ctx) {
        $code = strtoupper(trim((string)($ctx['promo_code'] ?? '')));
        if (!empty($promo->promo_code) && $code !== strtoupper(trim($promo->promo_code))) {
            return "Promotion '{$promo->name}' needs its promo code.";
        }
        foreach ($promo->conditions as $cond) {
            $val = $cond->requirement_value;
            switch ($cond->condition_type) {
                case 'MinAmount':
                    if ($subtotal + 0.004 < (float)$val) return "Minimum bill of " . number_format((float)$val, 2) . " not met.";
                    break;
                case 'MinQty':
                    if (array_sum(array_column($lines, 'qty')) < (float)$val) return "Minimum quantity of {$val} not met.";
                    break;
                case 'ItemList':
                    $req = self::ids($val);
                    if ($req && !array_filter($lines, function ($l) use ($req) { return in_array($l['id'], $req, true); })) {
                        return "Required promotional items are missing from the cart.";
                    }
                    break;
                case 'CollectionList':
                    $req = self::ids($val);
                    if ($req && !array_filter($lines, function ($l) use ($req) { return (bool)array_intersect($req, $l['cats']); })) {
                        return "No items from the promoted category are in the cart.";
                    }
                    break;
                case 'OrderType':
                    $want = array_map('trim', explode(',', strtolower((string)$val)));
                    $have = strtolower((string)($ctx['order_type'] ?? ''));
                    if ($want && $want !== [''] && !in_array($have, $want, true)) return "Promotion is for " . str_replace('_', ' ', implode(' / ', $want)) . " orders only.";
                    break;
                case 'BankCard':
                    if (!$bankId || (int)$val !== (int)$bankId) return "Promotion requires a specific bank card.";
                    break;
                case 'CardCategory':
                    if ($val !== 'Any' && $cardCategory !== $val) return "Promotion requires a {$val} card.";
                    break;
            }
        }
        return null;
    }

    /** True when the only failing condition is the bank card (shown as "pay with X card to save"). */
    private function onlyNeedsCard($promo, array $lines, $subtotal, array $ctx) {
        $hasCard = false;
        foreach ($promo->conditions as $c) if ($c->condition_type === 'BankCard') $hasCard = true;
        if (!$hasCard) return false;
        $clone = clone $promo;
        $clone->conditions = array_values(array_filter($promo->conditions, function ($c) {
            return $c->condition_type !== 'BankCard' && $c->condition_type !== 'CardCategory';
        }));
        return $this->conditionReason($clone, $lines, $subtotal, null, null, $ctx) === null;
    }

    // ------------------------------------------------------------------ public matching API

    /**
     * Every offer the cart qualifies for, best first (single best offer applies; no stacking).
     * $ctx: promo_code, order_type, now, include_potential (adds offers that only need a bank card).
     */
    public function findEligiblePromotions($cartItems, $subtotal = null, $bankId = null, $cardCategory = null, $locationId = null, array $ctx = []) {
        $now = $ctx['now'] ?? time();
        $lines = $this->lines($cartItems);
        $subtotal = array_sum(array_column($lines, 'net')); // always from the lines, never trusted
        $matches = [];
        $potential = [];

        foreach ($this->getActiveRaw($locationId, $now) as $promo) {
            if ($this->conditionReason($promo, $lines, $subtotal, $bankId, $cardCategory, $ctx) === null) {
                $benefit = $this->calculateBenefitValue($promo, $lines, $subtotal);
                if ($benefit->discount_value > 0 || !empty($benefit->missing_rewards)) $matches[] = $benefit;
            } elseif (!empty($ctx['include_potential']) && $this->onlyNeedsCard($promo, $lines, $subtotal, $ctx)) {
                $benefit = $this->calculateBenefitValue($promo, $lines, $subtotal);
                if ($benefit->discount_value > 0) {
                    $benefit->bank_id = null;
                    foreach ($promo->conditions as $c) {
                        if ($c->condition_type === 'BankCard') $benefit->bank_id = (int)$c->requirement_value;
                        if ($c->condition_type === 'CardCategory') $benefit->card_category = $c->requirement_value;
                    }
                    $potential[] = $benefit;
                }
            }
        }

        usort($matches, function ($a, $b) { return $b->discount_value <=> $a->discount_value; });
        if (!empty($ctx['include_potential'])) {
            usort($potential, function ($a, $b) { return $b->discount_value <=> $a->discount_value; });
            return ['matches' => $matches, 'potential' => $potential];
        }
        return $matches;
    }

    public function findBestPromotion($cartItems, $subtotal = null, $bankId = null, $cardCategory = null, $locationId = null, array $ctx = []) {
        $matches = $this->findEligiblePromotions($cartItems, $subtotal, $bankId, $cardCategory, $locationId, $ctx);
        return !empty($matches) ? $matches[0] : null;
    }

    /** The benefit one specific promotion gives this cart, or a string explaining why not. */
    public function evaluate($promoId, $cartItems, $bankId = null, $cardCategory = null, $locationId = null, array $ctx = []) {
        $promo = $this->getPromotion($promoId);
        if (!$promo) return "Promotion ID {$promoId} does not exist.";
        $now = $ctx['now'] ?? time();
        $reason = $this->scheduleReason($promo, $locationId, $now);
        if ($reason) return $reason;
        $lines = $this->lines($cartItems);
        $subtotal = array_sum(array_column($lines, 'net'));
        $reason = $this->conditionReason($promo, $lines, $subtotal, $bankId, $cardCategory, $ctx);
        if ($reason) return $reason;
        $benefit = $this->calculateBenefitValue($promo, $lines, $subtotal);
        if ($benefit->discount_value <= 0 && empty($benefit->missing_rewards)) {
            return "Cart does not contain the required combination or quantities of items to trigger the discount.";
        }
        return $benefit;
    }

    /** Kept for older callers. */
    public function getPromotionRejectionReason($promoId, $cartItems, $subtotal, $bankId = null, $cardCategory = null, $locationId = null, array $ctx = []) {
        $r = $this->evaluate($promoId, $cartItems, $bankId, $cardCategory, $locationId, $ctx);
        return is_string($r) ? $r : "Unknown validation failure.";
    }

    /** Find a code-only promotion by its code (POS "enter promo code"). */
    public function findByCode($code) {
        $code = strtoupper(trim((string)$code));
        if ($code === '') return null;
        $this->db->query("SELECT * FROM {$this->table} WHERE UPPER(promo_code) = :c LIMIT 1");
        $this->db->bind(':c', $code);
        return $this->db->single() ?: null;
    }

    /** Records one use (inside the invoice transaction). False when the usage limit was reached. */
    public function recordUse($promoId, $invoiceId, $discount, Database $db) {
        $db->query("UPDATE {$this->table} SET used_count = used_count + 1
                    WHERE id = :id AND (usage_limit IS NULL OR usage_limit = 0 OR used_count < usage_limit)");
        $db->bind(':id', (int)$promoId);
        $db->execute();
        if ($db->rowCount() < 1) return false;
        $db->query("INSERT INTO promotion_usage (promotion_id, invoice_id, discount_amount) VALUES (:p, :i, :d)");
        $db->bind(':p', (int)$promoId);
        $db->bind(':i', (int)$invoiceId);
        $db->bind(':d', round((float)$discount, 2));
        $db->execute();
        return true;
    }

    /** Gives a use back when its invoice is cancelled. */
    public function releaseUse($invoiceId, Database $db) {
        try {
            $db->query("SELECT id, promotion_id FROM promotion_usage WHERE invoice_id = :i AND reversed_at IS NULL");
            $db->bind(':i', (int)$invoiceId);
            foreach ($db->resultSet() as $u) {
                $db->query("UPDATE promotion_usage SET reversed_at = NOW() WHERE id = :id");
                $db->bind(':id', (int)$u->id);
                $db->execute();
                $db->query("UPDATE {$this->table} SET used_count = GREATEST(used_count - 1, 0) WHERE id = :p");
                $db->bind(':p', (int)$u->promotion_id);
                $db->execute();
            }
        } catch (Exception $e) { error_log('Promotion releaseUse: ' . $e->getMessage()); }
    }

    private function getActiveRaw($locationId, $now) {
        $today = date('Y-m-d', $now);
        $this->db->query("SELECT * FROM {$this->table} WHERE is_active = 1
            AND (start_date IS NULL OR start_date <= :today) AND (end_date IS NULL OR end_date >= :today)
            ORDER BY priority DESC, id DESC");
        $this->db->bind(':today', $today);
        $out = [];
        foreach ($this->db->resultSet() as $promo) {
            if ($this->scheduleReason($promo, $locationId, $now) !== null) continue;
            $promo->conditions = $this->getConditions($promo->id);
            $promo->benefits = $this->getBenefits($promo->id);
            $out[] = $promo;
        }
        return $out;
    }

    // ------------------------------------------------------------------ benefit maths

    private function calculateBenefitValue($promo, array $lines, $subtotal) {
        $totalDiscount = 0.0;
        $breakdown = [];
        $missingRewards = null;

        // Default target from the conditions: "10% off item X" discounts item X, not the bill
        $condItems = [];
        $condCats = [];
        foreach ($promo->conditions as $c) {
            if ($c->condition_type === 'ItemList') $condItems = array_merge($condItems, self::ids($c->requirement_value));
            if ($c->condition_type === 'CollectionList') $condCats = array_merge($condCats, self::ids($c->requirement_value));
        }

        $addLine = function ($id, $amt) use (&$breakdown) {
            if ($amt <= 0) return;
            $breakdown[$id] = round(($breakdown[$id] ?? 0) + $amt, 2);
        };

        foreach ($promo->benefits as $benefit) {
            $tItems = self::ids($benefit->target_items ?? null);
            $tCats = self::ids($benefit->target_categories ?? null);
            if (!$tItems && !$tCats) { $tItems = $condItems; $tCats = $condCats; }
            $targeted = array_values(array_filter($lines, function ($l) use ($tItems, $tCats) { return self::lineMatches($l, $tItems, $tCats); }));
            $base = array_sum(array_column($targeted, 'net'));
            $val = (float)$benefit->benefit_value;

            switch ($benefit->benefit_type) {
                case 'Percentage':
                    $pct = max(0, min(100, $val));
                    foreach ($targeted as $l) {
                        $d = $l['net'] * $pct / 100;
                        $totalDiscount += $d;
                        $addLine($l['id'], $d);
                    }
                    break;

                case 'FixedAmount':
                    $d = min($val, $base);
                    $totalDiscount += $d;
                    foreach ($targeted as $l) if ($base > 0) $addLine($l['id'], $d * $l['net'] / $base);
                    break;

                case 'FixedPrice':
                    // Bundle: each complete set of the listed items sells for the fixed price
                    if ($tItems) {
                        $sets = PHP_INT_MAX;
                        $setValue = 0;
                        foreach (array_unique($tItems) as $iid) {
                            $q = 0; $unit = 0;
                            foreach ($lines as $l) if ($l['id'] === $iid) { $q += $l['qty']; $unit = max($unit, $l['unit_net']); }
                            $sets = min($sets, floor($q));
                            $setValue += $unit;
                        }
                        if ($sets === PHP_INT_MAX || $sets <= 0) break;
                        $d = max(0, ($setValue - $val) * $sets);
                    } else {
                        $d = max(0, $base - $val);
                    }
                    $totalDiscount += $d;
                    foreach ($targeted as $l) if ($base > 0) $addLine($l['id'], $d * $l['net'] / $base);
                    break;

                case 'BuyXGetY':
                    $triggerItems = self::ids($benefit->trigger_items ?? null);
                    $rewardItems = self::ids($benefit->reward_items ?? null);
                    $xCount = max(1, (int)($benefit->trigger_qty ?? 1));
                    $yCount = max(1, (int)($benefit->reward_qty ?? 1));
                    $discountPct = (float)($benefit->benefit_discount_pct ?? 100);

                    $triggerQty = 0;
                    foreach ($lines as $l) if (!$triggerItems || in_array($l['id'], $triggerItems, true)) $triggerQty += $l['qty'];
                    $cycles = (int)floor($triggerQty / $xCount);
                    if ($cycles <= 0) break;

                    // Cheapest eligible units are the free ones
                    $pool = [];
                    foreach ($lines as $l) {
                        if ($rewardItems && !in_array($l['id'], $rewardItems, true)) continue;
                        for ($k = 0; $k < (int)$l['qty']; $k++) $pool[] = ['id' => $l['id'], 'price' => $l['unit_net']];
                    }
                    usort($pool, function ($a, $b) { return $a['price'] <=> $b['price']; });

                    // Same item as trigger and reward (buy 2 get 1): the reward units can't also be triggers
                    if (!$rewardItems || $rewardItems == $triggerItems) {
                        $cycles = (int)floor(count($pool) / ($xCount + $yCount));
                    }

                    $toDiscount = min(count($pool), $cycles * $yCount);
                    for ($k = 0; $k < $toDiscount; $k++) {
                        $d = $pool[$k]['price'] * $discountPct / 100;
                        $totalDiscount += $d;
                        $addLine($pool[$k]['id'], $d);
                    }

                    $cyclesForMissing = (int)floor($triggerQty / $xCount);
                    $missingQty = ($cyclesForMissing * $yCount) - $toDiscount;
                    if ($missingQty > 0 && $rewardItems && $rewardItems != $triggerItems) {
                        $firstRewardId = (int)$rewardItems[0];
                        $this->db->query("SELECT price, part_name FROM parts WHERE id = :id");
                        $this->db->bind(':id', $firstRewardId);
                        $rItem = $this->db->single();
                        if ($rItem) {
                            $missingRewards = [
                                'item_id' => $firstRewardId,
                                'item_name' => $rItem->part_name,
                                'qty' => $missingQty,
                                'potential_discount' => round(($rItem->price * ($discountPct / 100)) * $missingQty, 2),
                            ];
                        }
                    }
                    break;
            }
        }

        // Cap per bill, and never more than the bill itself
        $cap = (float)($promo->max_discount ?? 0);
        $final = min($totalDiscount, $subtotal);
        if ($cap > 0) $final = min($final, $cap);
        if ($totalDiscount > 0 && $final < $totalDiscount) {
            $ratio = $final / $totalDiscount;
            foreach ($breakdown as $k => $v) $breakdown[$k] = round($v * $ratio, 2);
        }

        $result = [
            'promotion_id' => (int)$promo->id,
            'name' => $promo->name,
            'type' => $promo->type,
            'description' => $promo->description ?? '',
            'discount_value' => round($final, 2),
            'capped' => $cap > 0 && $totalDiscount > $cap,
            'requires_code' => !empty($promo->promo_code),
            'ends' => $promo->end_date ? trim($promo->end_date . ' ' . ($promo->end_time ?? '')) : null,
            'item_breakdown' => $breakdown,
        ];
        if ($missingRewards) $result['missing_rewards'] = $missingRewards;
        return (object)$result;
    }

    // ------------------------------------------------------------------ writing

    public function savePromotion($data) {
        $id = $data['id'] ?? null;
        // Editors that don't know a field (older offer templates) keep its saved value
        if ($id && ($existing = $this->getPromotion($id))) {
            foreach (['start_time', 'end_time', 'days_of_week', 'promo_code', 'usage_limit', 'max_discount'] as $k) {
                if (!array_key_exists($k, $data)) $data[$k] = $existing->$k ?? null;
            }
        }
        $time = function ($v) { $v = trim((string)($v ?? '')); return preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $v) ? (strlen($v) <= 5 ? $v . ':00' : $v) : null; };
        $days = $data['days_of_week'] ?? '';
        if (is_array($days)) $days = implode(',', array_filter(array_map('intval', $days), function ($d) { return $d >= 1 && $d <= 7; }));
        $code = strtoupper(trim((string)($data['promo_code'] ?? '')));
        $code = $code === '' ? null : preg_replace('/[^A-Z0-9_-]/', '', $code);

        if ($code) {
            $this->db->query("SELECT id FROM {$this->table} WHERE UPPER(promo_code) = :c AND id <> :id");
            $this->db->bind(':c', $code);
            $this->db->bind(':id', (int)$id);
            if ($this->db->single()) throw new Exception("Promo code {$code} is already used by another promotion.");
        }

        try {
            $this->db->beginTransaction();
            $cols = "name = :name, description = :description, type = :type, start_date = :start_date, end_date = :end_date,
                     start_time = :start_time, end_time = :end_time, days_of_week = :days, promo_code = :code,
                     usage_limit = :usage_limit, max_discount = :max_discount,
                     is_active = :is_active, priority = :priority, applicable_locations = :locations";
            if ($id) {
                $this->db->query("UPDATE promotions SET $cols, updated_by = :uid WHERE id = :id");
                $this->db->bind(':id', $id);
            } else {
                $this->db->query("INSERT INTO promotions SET $cols, created_by = :uid");
            }
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':description', $data['description'] ?? '');
            $this->db->bind(':type', in_array($data['type'] ?? '', ['Discount', 'Bundle', 'BOGO', 'Bulk'], true) ? $data['type'] : 'Discount');
            $this->db->bind(':start_date', !empty($data['start_date']) ? $data['start_date'] : null);
            $this->db->bind(':end_date', !empty($data['end_date']) ? $data['end_date'] : null);
            $this->db->bind(':start_time', $time($data['start_time'] ?? null));
            $this->db->bind(':end_time', $time($data['end_time'] ?? null));
            $this->db->bind(':days', $days !== '' ? $days : null);
            $this->db->bind(':code', $code);
            $this->db->bind(':usage_limit', max(0, (int)($data['usage_limit'] ?? 0)));
            $this->db->bind(':max_discount', max(0, (float)($data['max_discount'] ?? 0)));
            $this->db->bind(':is_active', (int)($data['is_active'] ?? 1));
            $this->db->bind(':priority', (int)($data['priority'] ?? 0));
            $locs = $data['applicable_locations'] ?? null;
            $this->db->bind(':locations', is_array($locs) ? ($locs ? json_encode(array_values($locs)) : null) : ($locs ?: null));
            $this->db->bind(':uid', $data['userId'] ?? null);
            $this->db->execute();
            if (!$id) $id = $this->db->lastInsertId();

            $this->db->query("DELETE FROM promotion_conditions WHERE promotion_id = :pid");
            $this->db->bind(':pid', $id);
            $this->db->execute();
            foreach (($data['conditions'] ?? []) as $cond) {
                $this->db->query("INSERT INTO promotion_conditions (promotion_id, condition_type, requirement_value, operator) VALUES (:pid, :type, :val, :op)");
                $this->db->bind(':pid', $id);
                $this->db->bind(':type', $cond['condition_type']);
                $this->db->bind(':val', is_array($cond['requirement_value']) ? json_encode($cond['requirement_value']) : (string)$cond['requirement_value']);
                $this->db->bind(':op', in_array($cond['operator'] ?? '', ['>=', '=', 'IN'], true) ? $cond['operator'] : '=');
                $this->db->execute();
            }

            $this->db->query("DELETE FROM promotion_benefits WHERE promotion_id = :pid");
            $this->db->bind(':pid', $id);
            $this->db->execute();
            $json = function ($v) { if (is_array($v)) return $v ? json_encode(array_values($v)) : null; return ($v === '' || $v === '[]') ? null : $v; };
            foreach (($data['benefits'] ?? []) as $benefit) {
                $this->db->query("INSERT INTO promotion_benefits (promotion_id, benefit_type, benefit_value, trigger_items, reward_items, trigger_qty, reward_qty, benefit_discount_pct, target_items, target_categories)
                                  VALUES (:pid, :type, :val, :ti, :ri, :tq, :rq, :dp, :tgi, :tgc)");
                $this->db->bind(':pid', $id);
                $this->db->bind(':type', $benefit['benefit_type']);
                $this->db->bind(':val', $benefit['benefit_value'] ?? 0);
                $this->db->bind(':ti', $json($benefit['trigger_items'] ?? null));
                $this->db->bind(':ri', $json($benefit['reward_items'] ?? null));
                $this->db->bind(':tq', (int)($benefit['trigger_qty'] ?? 1));
                $this->db->bind(':rq', (int)($benefit['reward_qty'] ?? 1));
                $this->db->bind(':dp', (float)($benefit['benefit_discount_pct'] ?? 100));
                $this->db->bind(':tgi', $json($benefit['target_items'] ?? null));
                $this->db->bind(':tgc', $json($benefit['target_categories'] ?? null));
                $this->db->execute();
            }

            $this->db->commit();
            return $id;
        } catch (Exception $e) {
            if ($this->db) $this->db->rollBack();
            throw $e;
        }
    }

    public function toggleActive($id, $status) {
        $this->db->query("UPDATE promotions SET is_active = :status WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':status', (int)$status);
        return $this->db->execute();
    }

    public function deletePromotion($id) {
        $this->db->query("DELETE FROM promotions WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
