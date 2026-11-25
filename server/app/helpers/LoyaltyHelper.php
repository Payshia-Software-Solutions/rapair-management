<?php
/**
 * LoyaltyHelper - the Loyalty & Rewards module (SaaS module id "loyalty").
 *
 * Tables (created on first use, see ensure()):
 *   loyalty_settings  key/value program settings
 *   loyalty_tiers     Silver / Gold / ... with the threshold to reach them and their benefits
 *   loyalty_members   one row per enrolled customer: member no, tier, points balance
 *   loyalty_ledger    every change of points (earn, redeem, adjust, reverse, expire, bonus);
 *                     the balance can always be rebuilt from it
 *
 * Points are earned on POS / invoice sales: (amount / earn_amount) * earn_points, times the
 * member's tier multiplier, rounded down. Customers used as a location's default ("Walk-in")
 * never earn.
 */
class LoyaltyHelper {
    public const DEFAULTS = [
        'enabled'          => '0',
        'program_name'     => 'Rewards',
        'earn_amount'      => '100',       // spend this much...
        'earn_points'      => '1',         // ...to earn this many points
        'earn_basis'       => 'pre_tax',   // pre_tax: after discounts, before tax & service charge; total: grand total
        'min_bill'         => '0',         // bills below this earn nothing
        'point_value'      => '1',         // money value of one point when redeemed (Phase 3)
        'min_redeem'       => '100',
        'max_redeem_pct'   => '50',
        'expiry_months'    => '0',         // 0 = points never expire
        'tier_basis'       => 'spend_12m', // spend_12m | lifetime_points
        'auto_enroll'      => '1',         // a customer's first POS sale enrolls them
        'sms_on_earn'      => '0',         // text the customer their points after a sale
        'sms_on_tier_up'   => '0',         // text the customer when they move up a tier
        'last_daily_run'   => '',          // internal: date the daily jobs last ran
        'last_tier_review' => '',          // internal: month (Y-m) of the last tier review
    ];

    private static $ready = false;

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

    public static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        $sql = [
            "CREATE TABLE IF NOT EXISTS loyalty_settings (
                setting_key VARCHAR(50) PRIMARY KEY,
                setting_value TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS loyalty_tiers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(40) NOT NULL,
                color VARCHAR(20) NOT NULL DEFAULT '#94a3b8',
                threshold DECIMAL(14,2) NOT NULL DEFAULT 0,
                multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
                discount_pct DECIMAL(5,2) NOT NULL DEFAULT 0.00,
                birthday_points INT NOT NULL DEFAULT 0,
                sort_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS loyalty_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                member_no VARCHAR(20) NULL,
                tier_id INT NULL,
                tier_locked TINYINT(1) NOT NULL DEFAULT 0,
                points_balance INT NOT NULL DEFAULT 0,
                lifetime_points INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_lm_customer (customer_id),
                UNIQUE KEY uq_lm_no (member_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS loyalty_ledger (
                id INT AUTO_INCREMENT PRIMARY KEY,
                member_id INT NOT NULL,
                type VARCHAR(10) NOT NULL,
                points INT NOT NULL,
                amount DECIMAL(14,2) NOT NULL DEFAULT 0,
                invoice_id INT NULL,
                location_id INT NULL,
                note VARCHAR(255) NULL,
                expires_at DATE NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ll_member (member_id, created_at),
                INDEX idx_ll_invoice (invoice_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('Loyalty schema: ' . $e->getMessage()); }
        }
        // Starter tiers so a new program is usable straight away
        try {
            $db->query("SELECT COUNT(*) n FROM loyalty_tiers");
            if ((int)$db->single()->n === 0) {
                foreach ([['Silver', '#94a3b8', 0, 1, 0, 0], ['Gold', '#f59e0b', 100000, 1.5, 0, 0], ['Platinum', '#6366f1', 300000, 2, 0, 0]] as $i => $t) {
                    $db->query("INSERT INTO loyalty_tiers (name, color, threshold, multiplier, discount_pct, birthday_points, sort_order) VALUES (:n, :c, :th, :m, :d, :b, :s)");
                    $db->bind(':n', $t[0]); $db->bind(':c', $t[1]); $db->bind(':th', $t[2]); $db->bind(':m', $t[3]);
                    $db->bind(':d', $t[4]); $db->bind(':b', $t[5]); $db->bind(':s', $i);
                    $db->execute();
                }
            }
        } catch (Exception $e) { error_log('Loyalty tiers seed: ' . $e->getMessage()); }
    }

    public static function settings(Database $db): array {
        return self::run($db, function () use ($db) {
            $db->query("SELECT setting_key, setting_value FROM loyalty_settings");
            $out = self::DEFAULTS;
            foreach ($db->resultSet() ?: [] as $r) if (array_key_exists($r->setting_key, $out)) $out[$r->setting_key] = (string)$r->setting_value;
            return $out;
        });
    }

    public static function tiers(Database $db, bool $activeOnly = false): array {
        return self::run($db, function () use ($db, $activeOnly) {
            $db->query("SELECT * FROM loyalty_tiers" . ($activeOnly ? " WHERE is_active = 1" : "") . " ORDER BY threshold, sort_order, id");
            return $db->resultSet() ?: [];
        });
    }

    /** Customers set as a location's default (walk-in) never join or earn. */
    public static function isWalkIn(Database $db, int $customerId): bool {
        $db->query("SELECT COUNT(*) n FROM service_locations WHERE default_customer_id = :c");
        $db->bind(':c', $customerId);
        return (int)$db->single()->n > 0;
    }

    public static function memberByCustomer(Database $db, int $customerId) {
        return self::run($db, function () use ($db, $customerId) {
            $db->query("SELECT m.*, t.name tier_name, t.color tier_color, t.multiplier, t.discount_pct
                FROM loyalty_members m LEFT JOIN loyalty_tiers t ON t.id = m.tier_id WHERE m.customer_id = :c");
            $db->bind(':c', $customerId);
            return $db->single() ?: null;
        });
    }

    /** Enrolls a customer (no-op if already a member). Returns the member row or null for walk-ins. */
    public static function enroll(Database $db, int $customerId) {
        if ($customerId <= 0 || self::isWalkIn($db, $customerId)) return null;
        $m = self::memberByCustomer($db, $customerId);
        if ($m) return $m;
        $tiers = self::tiers($db, true);
        $db->query("INSERT IGNORE INTO loyalty_members (customer_id, tier_id) VALUES (:c, :t)");
        $db->bind(':c', $customerId);
        $db->bind(':t', $tiers ? (int)$tiers[0]->id : null);
        $db->execute();
        $id = (int)$db->lastInsertId();
        if ($id) {
            $db->query("UPDATE loyalty_members SET member_no = :n WHERE id = :id");
            $db->bind(':n', 'LM' . str_pad((string)$id, 6, '0', STR_PAD_LEFT));
            $db->bind(':id', $id);
            $db->execute();
        }
        return self::memberByCustomer($db, $customerId);
    }

    /** Adds a ledger line and moves the balance. Positive points also count towards lifetime points. */
    public static function post(Database $db, int $memberId, string $type, int $points, array $extra = []) {
        $db->query("INSERT INTO loyalty_ledger (member_id, type, points, amount, invoice_id, location_id, note, expires_at, created_by)
            VALUES (:m, :t, :p, :a, :i, :l, :n, :e, :u)");
        $db->bind(':m', $memberId);
        $db->bind(':t', $type);
        $db->bind(':p', $points);
        $db->bind(':a', (float)($extra['amount'] ?? 0));
        $db->bind(':i', $extra['invoice_id'] ?? null);
        $db->bind(':l', $extra['location_id'] ?? null);
        $db->bind(':n', isset($extra['note']) ? mb_substr((string)$extra['note'], 0, 255) : null);
        $db->bind(':e', $extra['expires_at'] ?? null);
        $db->bind(':u', $extra['user_id'] ?? null);
        $db->execute();
        $db->query("UPDATE loyalty_members SET points_balance = points_balance + :p,
            lifetime_points = lifetime_points + GREATEST(:p2, 0) WHERE id = :m");
        $db->bind(':p', $points);
        $db->bind(':p2', in_array($type, ['earn', 'bonus'], true) ? $points : 0);
        $db->bind(':m', $memberId);
        $db->execute();
    }

    /** What decides the tier: spend in the last 12 months, or lifetime points. */
    public static function tierMetric(Database $db, $member, array $settings): float {
        if (($settings['tier_basis'] ?? 'spend_12m') === 'lifetime_points') return (float)$member->lifetime_points;
        $db->query("SELECT COALESCE(SUM(CASE WHEN type = 'earn' THEN amount WHEN type = 'reverse' THEN -amount ELSE 0 END), 0) s
            FROM loyalty_ledger WHERE member_id = :m AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)");
        $db->bind(':m', (int)$member->id);
        return (float)$db->single()->s;
    }

    /** Moves the member up when they reach a higher tier. Downgrades happen in the periodic review. */
    public static function applyUpgrade(Database $db, int $memberId, array $settings) {
        $db->query("SELECT * FROM loyalty_members WHERE id = :m");
        $db->bind(':m', $memberId);
        $m = $db->single();
        if (!$m || (int)$m->tier_locked) return null;
        $metric = self::tierMetric($db, $m, $settings);
        $best = null;
        foreach (self::tiers($db, true) as $t) if ((float)$t->threshold <= $metric) $best = $t;
        if (!$best || (int)$best->id === (int)$m->tier_id) return null;
        $current = null;
        foreach (self::tiers($db, true) as $t) if ((int)$t->id === (int)$m->tier_id) $current = $t;
        if ($current && (float)$current->threshold >= (float)$best->threshold) return null; // upgrades only
        $db->query("UPDATE loyalty_members SET tier_id = :t WHERE id = :m");
        $db->bind(':t', (int)$best->id);
        $db->bind(':m', $memberId);
        $db->execute();
        return $best->name;
    }

    /**
     * Earn points for a finished sale. Safe to call after the invoice is committed: errors are
     * logged, never thrown, and an invoice never earns twice.
     * Returns ['points','balance','tier','tier_up','member_no'] or null.
     */
    public static function earnForInvoice(Database $db, int $invoiceId, $userId = null) {
        try {
            if (!class_exists('SaasHelper')) require_once __DIR__ . '/SaasHelper.php';
            if (!SaasHelper::isModuleEnabled('loyalty')) return null;
            $s = self::settings($db);
            if ($s['enabled'] !== '1') return null;
            self::runDaily($db);

            $db->query("SELECT id, customer_id, location_id, subtotal, discount_total, grand_total FROM invoices WHERE id = :id");
            $db->bind(':id', $invoiceId);
            $inv = $db->single();
            if (!$inv || !(int)$inv->customer_id) return null;

            $member = self::memberByCustomer($db, (int)$inv->customer_id);
            if (!$member && $s['auto_enroll'] === '1') $member = self::enroll($db, (int)$inv->customer_id);
            if (!$member || !(int)$member->is_active) return null;

            $db->query("SELECT COUNT(*) n FROM loyalty_ledger WHERE invoice_id = :i AND type = 'earn'");
            $db->bind(':i', $invoiceId);
            if ((int)$db->single()->n > 0) return null;

            $amount = $s['earn_basis'] === 'total'
                ? (float)$inv->grand_total
                : max(0, (float)$inv->subtotal - (float)$inv->discount_total);
            if ($amount <= 0 || $amount < (float)$s['min_bill']) return null;
            $per = max(0.01, (float)$s['earn_amount']);
            $mult = max(0, (float)($member->multiplier ?? 1)) ?: 1;
            $points = (int)floor(($amount / $per) * (float)$s['earn_points'] * $mult);
            if ($points <= 0) return null;

            $months = (int)$s['expiry_months'];
            self::post($db, (int)$member->id, 'earn', $points, [
                'amount' => $amount, 'invoice_id' => $invoiceId, 'location_id' => (int)$inv->location_id,
                'expires_at' => $months > 0 ? date('Y-m-d', strtotime("+$months months")) : null,
                'user_id' => $userId, 'note' => $mult != 1 ? "Tier ×$mult" : null,
            ]);
            $tierUp = self::applyUpgrade($db, (int)$member->id, $s);
            $after = self::memberByCustomer($db, (int)$inv->customer_id);
            if ($s['sms_on_earn'] === '1') {
                self::smsTo($db, (int)$inv->customer_id, "{$s['program_name']}: you earned $points points. Balance: {$after->points_balance} points.");
            }
            if ($tierUp && $s['sms_on_tier_up'] === '1') {
                self::smsTo($db, (int)$inv->customer_id, "{$s['program_name']}: congratulations, you are now $tierUp!");
            }
            return [
                'points' => $points,
                'balance' => (int)$after->points_balance,
                'tier' => $after->tier_name,
                'tier_up' => $tierUp,
                'member_no' => $after->member_no,
                'program' => $s['program_name'],
            ];
        } catch (Throwable $e) {
            error_log('Loyalty earn for invoice ' . $invoiceId . ': ' . $e->getMessage());
            return null;
        }
    }

    public static function saveSetting(Database $db, string $key, string $value) {
        $db->query("REPLACE INTO loyalty_settings (setting_key, setting_value) VALUES (:k, :v)");
        $db->bind(':k', $key);
        $db->bind(':v', $value);
        $db->execute();
    }

    private static function smsTo(Database $db, int $customerId, string $text) {
        try {
            $db->query("SELECT phone FROM customers WHERE id = :c");
            $db->bind(':c', $customerId);
            $phone = trim((string)($db->single()->phone ?? ''));
            if ($phone === '') return;
            require_once __DIR__ . '/SmsHelper.php';
            SmsHelper::send($phone, $text);
        } catch (Throwable $e) { error_log('Loyalty SMS: ' . $e->getMessage()); }
    }

    // ---------------- Redeem (Phase 3) ----------------

    /**
     * What the member may use on a bill: tier discount and points.
     * $base = bill after line/bill/promo discounts, before tax (the POS's taxable amount).
     */
    public static function allowance(Database $db, $member, array $s, float $base): array {
        $tierPct = (float)($member->discount_pct ?? 0);
        $tierDisc = round(max(0, $base) * $tierPct / 100, 2);
        $after = max(0, $base - $tierDisc);
        $pv = max(0, (float)$s['point_value']);
        $maxByPct = $after * max(0, min(100, (int)$s['max_redeem_pct'])) / 100;
        $maxPts = $pv > 0 ? (int)floor(min((int)$member->points_balance * $pv, $maxByPct) / $pv) : 0;
        if ($maxPts < (int)$s['min_redeem']) $maxPts = 0;
        return ['tier_pct' => $tierPct, 'tier_discount' => $tierDisc, 'point_value' => $pv, 'max_points' => $maxPts,
            'min_points' => (int)$s['min_redeem'], 'balance' => (int)$member->points_balance];
    }

    /**
     * Checks a POS bill's loyalty part before the invoice is saved. Returns [ok, message].
     * $data carries loyalty_redeem_points, loyalty_redeem_value, loyalty_tier_discount, loyalty_base.
     */
    public static function validateBill(Database $db, array $data): array {
        $pts = (int)($data['loyalty_redeem_points'] ?? 0);
        $tier = (float)($data['loyalty_tier_discount'] ?? 0);
        if ($pts <= 0 && $tier <= 0) return [true, null];
        if (!class_exists('SaasHelper')) require_once __DIR__ . '/SaasHelper.php';
        if (!SaasHelper::isModuleEnabled('loyalty')) return [false, 'Loyalty is not part of this plan.'];
        $s = self::settings($db);
        if ($s['enabled'] !== '1') return [false, 'The loyalty program is switched off.'];
        $m = self::memberByCustomer($db, (int)($data['customer_id'] ?? 0));
        if (!$m || !(int)$m->is_active) return [false, 'This customer is not an active loyalty member.'];
        // The POS sends the bill amount the discount is based on; it can't be more than the bill itself
        $base = (float)($data['loyalty_base'] ?? 0);
        $cap = (float)($data['display_subtotal'] ?? $data['subtotal'] ?? $base);
        if ($cap > 0) $base = min($base, $cap);
        $a = self::allowance($db, $m, $s, $base);
        if ($tier > $a['tier_discount'] + 0.05) return [false, 'The member discount is higher than the tier allows.'];
        if ($pts > 0) {
            if ($pts > (int)$m->points_balance) return [false, "Only {$m->points_balance} points are available."];
            if ($pts < $a['min_points']) return [false, "At least {$a['min_points']} points are needed to redeem."];
            if ($pts > $a['max_points']) return [false, "At most {$a['max_points']} points can be used on this bill."];
            $value = round($pts * $a['point_value'], 2);
            if (abs($value - (float)($data['loyalty_redeem_value'] ?? 0)) > 0.05) return [false, 'Points value does not match. Refresh the POS and try again.'];
        }
        return [true, null];
    }

    /** Takes the redeemed points off the balance once the invoice is saved. */
    public static function redeemForInvoice(Database $db, int $invoiceId, array $data, $userId = null) {
        $pts = (int)($data['loyalty_redeem_points'] ?? 0);
        if ($pts <= 0) return 0;
        try {
            $m = self::memberByCustomer($db, (int)($data['customer_id'] ?? 0));
            if (!$m) return 0;
            $db->query("SELECT COUNT(*) n FROM loyalty_ledger WHERE invoice_id = :i AND type = 'redeem'");
            $db->bind(':i', $invoiceId);
            if ((int)$db->single()->n > 0) return 0;
            self::post($db, (int)$m->id, 'redeem', -$pts, [
                'amount' => (float)($data['loyalty_redeem_value'] ?? 0), 'invoice_id' => $invoiceId,
                'location_id' => (int)($data['location_id'] ?? 0), 'user_id' => $userId,
            ]);
            return $pts;
        } catch (Throwable $e) {
            error_log('Loyalty redeem for invoice ' . $invoiceId . ': ' . $e->getMessage());
            return 0;
        }
    }

    // ---------------- Reversals (Phase 3) ----------------

    /** Net points this invoice earned / redeemed so far (after earlier reversals). */
    private static function invoiceNet(Database $db, int $invoiceId) {
        $db->query("SELECT member_id,
                COALESCE(SUM(CASE WHEN type = 'earn' THEN points WHEN type = 'reverse' AND note LIKE 'Earned%' THEN points ELSE 0 END), 0) earned,
                COALESCE(SUM(CASE WHEN type = 'earn' THEN amount WHEN type = 'reverse' AND note LIKE 'Earned%' THEN -amount ELSE 0 END), 0) earned_amount,
                COALESCE(SUM(CASE WHEN type = 'redeem' THEN -points WHEN type = 'reverse' AND note LIKE 'Redeemed%' THEN -points ELSE 0 END), 0) redeemed
            FROM loyalty_ledger WHERE invoice_id = :i GROUP BY member_id LIMIT 1");
        $db->bind(':i', $invoiceId);
        return $db->single() ?: null;
    }

    /** Invoice cancelled: earned points are taken back and redeemed points are returned. */
    public static function reverseInvoice(Database $db, int $invoiceId, $userId = null) {
        try {
            $n = self::run($db, fn() => self::invoiceNet($db, $invoiceId));
            if (!$n) return;
            if ((int)$n->earned > 0) {
                self::post($db, (int)$n->member_id, 'reverse', -(int)$n->earned, ['amount' => (float)$n->earned_amount, 'invoice_id' => $invoiceId,
                    'note' => 'Earned points taken back: invoice cancelled', 'user_id' => $userId]);
            }
            if ((int)$n->redeemed > 0) {
                self::post($db, (int)$n->member_id, 'reverse', (int)$n->redeemed, ['invoice_id' => $invoiceId,
                    'note' => 'Redeemed points returned: invoice cancelled', 'user_id' => $userId]);
            }
        } catch (Throwable $e) { error_log('Loyalty reverse invoice ' . $invoiceId . ': ' . $e->getMessage()); }
    }

    /** Items returned: earned points are taken back in proportion to the returned value. */
    public static function reverseForReturn(Database $db, int $invoiceId, float $returnAmount, $returnNo = null, $userId = null) {
        try {
            if ($invoiceId <= 0 || $returnAmount <= 0) return;
            $n = self::run($db, fn() => self::invoiceNet($db, $invoiceId));
            if (!$n || (int)$n->earned <= 0 || (float)$n->earned_amount <= 0) return;
            $share = min(1, $returnAmount / (float)$n->earned_amount);
            $pts = min((int)$n->earned, (int)ceil((int)$n->earned * $share));
            if ($pts <= 0) return;
            self::post($db, (int)$n->member_id, 'reverse', -$pts, ['amount' => round((float)$n->earned_amount * $share, 2), 'invoice_id' => $invoiceId,
                'note' => 'Earned points taken back: return' . ($returnNo ? " $returnNo" : ''), 'user_id' => $userId]);
        } catch (Throwable $e) { error_log('Loyalty reverse return ' . $invoiceId . ': ' . $e->getMessage()); }
    }

    // ---------------- Daily jobs (Phase 4) ----------------

    /**
     * Expiry, birthday points and the monthly tier review. Runs at most once a day per workspace,
     * started by normal loyalty traffic (no cron needed on shared hosting).
     */
    public static function runDaily(Database $db, bool $force = false): ?array {
        try {
            $s = self::settings($db);
            $today = date('Y-m-d');
            if (!$force && ($s['last_daily_run'] === $today || $s['enabled'] !== '1')) return null;
            self::saveSetting($db, 'last_daily_run', $today);
            $out = ['expired_members' => 0, 'expired_points' => 0, 'birthdays' => 0, 'tier_changes' => 0];

            // 1. Expiry, first in first out. Pool = points of expired earn lines (less what was taken
            //    back on those same bills); used = points actually spent or already expired (redeemed
            //    points given back on a cancelled bill don't count as spent). Due = pool - used.
            $db->query("SELECT m.id, m.points_balance,
                    COALESCE((SELECT SUM(points) FROM loyalty_ledger WHERE member_id = m.id AND type IN ('earn','bonus')
                        AND expires_at IS NOT NULL AND expires_at < CURDATE()), 0)
                    + COALESCE((SELECT SUM(r.points) FROM loyalty_ledger r WHERE r.member_id = m.id AND r.type = 'reverse' AND r.note LIKE 'Earned%'
                        AND EXISTS (SELECT 1 FROM loyalty_ledger e WHERE e.member_id = m.id AND e.type = 'earn' AND e.invoice_id = r.invoice_id
                                    AND e.expires_at IS NOT NULL AND e.expires_at < CURDATE())), 0) AS expired_pool,
                    COALESCE((SELECT -SUM(points) FROM loyalty_ledger WHERE member_id = m.id AND type IN ('redeem','adjust','expire') AND points < 0), 0)
                    - COALESCE((SELECT SUM(points) FROM loyalty_ledger WHERE member_id = m.id AND type = 'reverse' AND note LIKE 'Redeemed%'), 0) AS used
                FROM loyalty_members m WHERE m.points_balance > 0");
            foreach ($db->resultSet() ?: [] as $r) {
                $due = min((int)$r->points_balance, max(0, (int)$r->expired_pool - (int)$r->used));
                if ($due > 0) {
                    self::post($db, (int)$r->id, 'expire', -$due, ['note' => 'Points expired']);
                    $out['expired_members']++;
                    $out['expired_points'] += $due;
                }
            }

            // 2. Birthday points, once a year on the customer's birthday (only when customers have a
            //    date-of-birth column; the customer form may not collect it yet)
            $dobCol = null;
            foreach (['dob', 'date_of_birth', 'birthday', 'birth_date'] as $col) {
                $db->query("SHOW COLUMNS FROM customers LIKE '$col'");
                if ($db->single()) { $dobCol = $col; break; }
            }
            $birthdayRows = [];
            if ($dobCol) {
                $db->query("SELECT m.id, m.customer_id, t.birthday_points FROM loyalty_members m
                    JOIN customers c ON c.id = m.customer_id
                    JOIN loyalty_tiers t ON t.id = m.tier_id
                    WHERE m.is_active = 1 AND t.birthday_points > 0 AND c.`$dobCol` IS NOT NULL
                      AND DATE_FORMAT(c.`$dobCol`, '%m-%d') = DATE_FORMAT(CURDATE(), '%m-%d')
                      AND NOT EXISTS (SELECT 1 FROM loyalty_ledger l WHERE l.member_id = m.id AND l.type = 'bonus'
                                      AND l.note = 'Birthday points' AND YEAR(l.created_at) = YEAR(CURDATE()))");
                $birthdayRows = $db->resultSet() ?: [];
            }
            $out['birthday_ready'] = (bool)$dobCol;
            $months = (int)$s['expiry_months'];
            foreach ($birthdayRows as $r) {
                self::post($db, (int)$r->id, 'bonus', (int)$r->birthday_points, ['note' => 'Birthday points',
                    'expires_at' => $months > 0 ? date('Y-m-d', strtotime("+$months months")) : null]);
                $out['birthdays']++;
            }

            // 3. Tier review once a month: everyone moves to the tier their spend / points earn
            $month = date('Y-m');
            if ($force || $s['last_tier_review'] !== $month) {
                self::saveSetting($db, 'last_tier_review', $month);
                $tiers = self::tiers($db, true);
                if ($tiers) {
                    $db->query("SELECT * FROM loyalty_members WHERE is_active = 1 AND tier_locked = 0");
                    foreach ($db->resultSet() ?: [] as $m) {
                        $metric = self::tierMetric($db, $m, $s);
                        $best = $tiers[0];
                        foreach ($tiers as $t) if ((float)$t->threshold <= $metric) $best = $t;
                        if ((int)$best->id !== (int)$m->tier_id) {
                            $db->query("UPDATE loyalty_members SET tier_id = :t WHERE id = :m");
                            $db->bind(':t', (int)$best->id);
                            $db->bind(':m', (int)$m->id);
                            $db->execute();
                            self::post($db, (int)$m->id, 'adjust', 0, ['note' => 'Monthly tier review: now ' . $best->name]);
                            $out['tier_changes']++;
                        }
                    }
                }
            }
            return $out;
        } catch (Throwable $e) {
            error_log('Loyalty daily jobs: ' . $e->getMessage());
            return null;
        }
    }

    /** Loyalty lines for one invoice (receipt): earned, redeemed and the balance now. */
    public static function invoiceSummary(Database $db, int $invoiceId) {
        try {
            return self::run($db, function () use ($db, $invoiceId) {
                $db->query("SELECT l.member_id,
                        SUM(CASE WHEN l.type = 'earn' THEN l.points ELSE 0 END) earned,
                        SUM(CASE WHEN l.type = 'redeem' THEN -l.points ELSE 0 END) redeemed,
                        SUM(CASE WHEN l.type = 'redeem' THEN l.amount ELSE 0 END) redeemed_value,
                        m.points_balance, m.member_no, t.name tier_name
                    FROM loyalty_ledger l JOIN loyalty_members m ON m.id = l.member_id
                    LEFT JOIN loyalty_tiers t ON t.id = m.tier_id
                    WHERE l.invoice_id = :i AND l.type IN ('earn','redeem')
                    GROUP BY l.member_id, m.points_balance, m.member_no, t.name LIMIT 1");
                $db->bind(':i', $invoiceId);
                $r = $db->single();
                if (!$r) return null;
                $s = self::settings($db);
                return ['program' => $s['program_name'], 'member_no' => $r->member_no, 'tier' => $r->tier_name,
                    'earned' => (int)$r->earned, 'redeemed' => (int)$r->redeemed, 'redeemed_value' => (float)$r->redeemed_value,
                    'balance' => (int)$r->points_balance];
            });
        } catch (Throwable $e) { return null; }
    }
}
