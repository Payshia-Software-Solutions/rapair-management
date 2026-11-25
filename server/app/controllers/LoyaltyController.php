<?php
/**
 * LoyaltyController - Loyalty & Rewards module (SaaS module "loyalty").
 *
 *   GET  /api/loyalty/settings            program settings + tiers
 *   POST /api/loyalty/settings            { settings: {...} }
 *   POST /api/loyalty/tiers               { tiers: [{ id?, name, color, threshold, multiplier, discount_pct, birthday_points, is_active }], deleted_ids: [] }
 *   GET  /api/loyalty/members?q=&tier=    members list with balance and tier
 *   GET  /api/loyalty/member?customer_id= one member: profile, tier progress, ledger
 *   POST /api/loyalty/enroll              { customer_id }
 *   POST /api/loyalty/adjust              { customer_id, points (+/-), reason }
 *   POST /api/loyalty/member_update       { customer_id, tier_id?, tier_locked?, is_active? }
 *   GET  /api/loyalty/lookup?customer_id= small card for the POS (null when not a member)
 *   GET  /api/loyalty/stats               dashboard numbers
 *
 * Screens need promotions.read / promotions.write; the POS lookup and enroll work with POS access.
 */
require_once __DIR__ . '/../helpers/LoyaltyHelper.php';

class LoyaltyController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    private function guard($perm) {
        $u = $this->requirePermission($perm);
        SaasHelper::requireModule('loyalty');
        return $u;
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    // ---------- settings & tiers ----------

    public function settings() {
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            $this->guard('promotions.write');
            $in = (array)($this->body()['settings'] ?? []);
            $clean = [];
            foreach (LoyaltyHelper::DEFAULTS as $k => $def) {
                if (!array_key_exists($k, $in) || strpos($k, 'last_') === 0) continue; // internal job markers
                $v = trim((string)$in[$k]);
                switch ($k) {
                    case 'enabled': case 'auto_enroll': case 'sms_on_earn': case 'sms_on_tier_up': $v = $v === '1' || $v === 'true' ? '1' : '0'; break;
                    case 'program_name': $v = mb_substr($v, 0, 60) ?: 'Rewards'; break;
                    case 'earn_basis': $v = $v === 'total' ? 'total' : 'pre_tax'; break;
                    case 'tier_basis': $v = $v === 'lifetime_points' ? 'lifetime_points' : 'spend_12m'; break;
                    case 'earn_amount': $v = (string)max(0.01, (float)$v); break;
                    case 'earn_points': case 'min_redeem': case 'expiry_months': $v = (string)max(0, (int)$v); break;
                    case 'max_redeem_pct': $v = (string)max(0, min(100, (int)$v)); break;
                    default: $v = (string)max(0, (float)$v);
                }
                $clean[$k] = $v;
            }
            if ((int)($clean['earn_points'] ?? 1) <= 0 && array_key_exists('earn_points', $clean)) {
                $this->error('Points per spend must be at least 1.', 422); return;
            }
            LoyaltyHelper::run($this->db, function () use ($clean) {
                foreach ($clean as $k => $v) {
                    $this->db->query("REPLACE INTO loyalty_settings (setting_key, setting_value) VALUES (:k, :v)");
                    $this->db->bind(':k', $k);
                    $this->db->bind(':v', $v);
                    $this->db->execute();
                }
            });
            $this->success(null, 'Loyalty settings saved');
            return;
        }
        $this->guard('promotions.read');
        $this->success([
            'settings' => LoyaltyHelper::settings($this->db),
            'tiers' => LoyaltyHelper::tiers($this->db),
        ]);
    }

    public function tiers() {
        $this->guard('promotions.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $tiers = array_values((array)($d['tiers'] ?? []));
        if (!$tiers) { $this->error('Keep at least one tier.', 422); return; }
        $names = [];
        foreach ($tiers as $t) {
            $n = mb_strtolower(trim((string)($t['name'] ?? '')));
            if ($n === '') { $this->error('Every tier needs a name.', 422); return; }
            if (isset($names[$n])) { $this->error('Two tiers have the same name.', 422); return; }
            $names[$n] = true;
        }
        $deleted = array_values(array_filter(array_map('intval', (array)($d['deleted_ids'] ?? []))));
        LoyaltyHelper::run($this->db, function () use ($tiers, $deleted) {
            $this->db->beginTransaction();
            try {
                if ($deleted) {
                    $in = implode(',', $deleted);
                    // Members on a removed tier drop to the lowest remaining one (fixed below)
                    $this->db->query("UPDATE loyalty_members SET tier_id = NULL WHERE tier_id IN ($in)");
                    $this->db->execute();
                    $this->db->query("DELETE FROM loyalty_tiers WHERE id IN ($in)");
                    $this->db->execute();
                }
                foreach ($tiers as $i => $t) {
                    $vals = [
                        ':n' => mb_substr(trim((string)$t['name']), 0, 40),
                        ':c' => preg_match('/^#[0-9a-fA-F]{6}$/', (string)($t['color'] ?? '')) ? $t['color'] : '#94a3b8',
                        ':th' => max(0, (float)($t['threshold'] ?? 0)),
                        ':m' => max(0, min(20, (float)($t['multiplier'] ?? 1))),
                        ':d' => max(0, min(100, (float)($t['discount_pct'] ?? 0))),
                        ':b' => max(0, (int)($t['birthday_points'] ?? 0)),
                        ':s' => $i,
                        ':a' => empty($t['is_active']) && isset($t['is_active']) ? 0 : 1,
                    ];
                    $id = (int)($t['id'] ?? 0);
                    if ($id) {
                        $this->db->query("UPDATE loyalty_tiers SET name = :n, color = :c, threshold = :th, multiplier = :m, discount_pct = :d,
                            birthday_points = :b, sort_order = :s, is_active = :a WHERE id = :id");
                        $this->db->bind(':id', $id);
                    } else {
                        $this->db->query("INSERT INTO loyalty_tiers (name, color, threshold, multiplier, discount_pct, birthday_points, sort_order, is_active)
                            VALUES (:n, :c, :th, :m, :d, :b, :s, :a)");
                    }
                    foreach ($vals as $k => $v) $this->db->bind($k, $v);
                    $this->db->execute();
                }
                // Members without a tier get the entry tier
                $this->db->query("UPDATE loyalty_members SET tier_id = (SELECT id FROM loyalty_tiers WHERE is_active = 1 ORDER BY threshold, sort_order LIMIT 1) WHERE tier_id IS NULL");
                $this->db->execute();
                $this->db->commit();
            } catch (Throwable $e) {
                $this->db->rollBack();
                throw $e;
            }
        });
        $this->success(LoyaltyHelper::tiers($this->db), 'Tiers saved');
    }

    // ---------- members ----------

    public function members() {
        $this->guard('promotions.read');
        $q = trim((string)($_GET['q'] ?? ''));
        $tier = (int)($_GET['tier'] ?? 0);
        $rows = LoyaltyHelper::run($this->db, function () use ($q, $tier) {
            $where = ['1=1'];
            if ($q !== '') $where[] = "(c.name LIKE :q OR c.phone LIKE :q2 OR m.member_no LIKE :q3)";
            if ($tier) $where[] = "m.tier_id = :t";
            $this->db->query("SELECT m.id, m.customer_id, m.member_no, m.points_balance, m.lifetime_points, m.is_active, m.joined_at, m.tier_locked,
                    c.name, c.phone, c.email, t.name tier_name, t.color tier_color
                FROM loyalty_members m
                JOIN customers c ON c.id = m.customer_id
                LEFT JOIN loyalty_tiers t ON t.id = m.tier_id
                WHERE " . implode(' AND ', $where) . " ORDER BY m.points_balance DESC, m.id DESC LIMIT 500");
            if ($q !== '') { $this->db->bind(':q', "%$q%"); $this->db->bind(':q2', "%$q%"); $this->db->bind(':q3', "%$q%"); }
            if ($tier) $this->db->bind(':t', $tier);
            return $this->db->resultSet() ?: [];
        });
        $this->success($rows);
    }

    /** Profile with tier progress and the latest ledger lines. */
    public function member() {
        $this->guard('promotions.read');
        $cid = (int)($_GET['customer_id'] ?? 0);
        $m = LoyaltyHelper::memberByCustomer($this->db, $cid);
        if (!$m) { $this->error('Not a member', 404); return; }
        $this->success($this->profile($m, true));
    }

    private function profile($m, bool $withLedger) {
        $s = LoyaltyHelper::settings($this->db);
        $tiers = LoyaltyHelper::tiers($this->db, true);
        $metric = LoyaltyHelper::tierMetric($this->db, $m, $s);
        $next = null;
        foreach ($tiers as $t) if ((float)$t->threshold > $metric) { $next = $t; break; }
        $this->db->query("SELECT name, phone, email FROM customers WHERE id = :c");
        $this->db->bind(':c', (int)$m->customer_id);
        $c = $this->db->single();
        $out = [
            'member' => $m,
            'customer' => $c,
            'tier_basis' => $s['tier_basis'],
            'tier_metric' => $metric,
            'next_tier' => $next ? ['name' => $next->name, 'color' => $next->color, 'threshold' => (float)$next->threshold, 'remaining' => (float)$next->threshold - $metric] : null,
            'point_value' => (float)$s['point_value'],
            'program' => $s['program_name'],
        ];
        // Points expiring in the next 30 days (earned lines not yet used up are approximated by their date)
        $this->db->query("SELECT COALESCE(SUM(points), 0) p FROM loyalty_ledger WHERE member_id = :m AND type IN ('earn','bonus')
            AND expires_at IS NOT NULL AND expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)");
        $this->db->bind(':m', (int)$m->id);
        $out['expiring_30d'] = min((int)$this->db->single()->p, (int)$m->points_balance);
        if ($withLedger) {
            $this->db->query("SELECT l.id, l.type, l.points, l.amount, l.invoice_id, l.note, l.expires_at, l.created_at, i.invoice_no, u.name AS user_name
                FROM loyalty_ledger l
                LEFT JOIN invoices i ON i.id = l.invoice_id
                LEFT JOIN users u ON u.id = l.created_by
                WHERE l.member_id = :m ORDER BY l.id DESC LIMIT 200");
            $this->db->bind(':m', (int)$m->id);
            $out['ledger'] = $this->db->resultSet() ?: [];
        }
        return $out;
    }

    public function enroll() {
        $this->guard(['promotions.write', 'pos.write', 'pos.read']);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $cid = (int)($this->body()['customer_id'] ?? 0);
        if (!$cid) { $this->error('Choose a customer', 422); return; }
        if (LoyaltyHelper::run($this->db, fn() => LoyaltyHelper::isWalkIn($this->db, $cid))) {
            $this->error("This is a location's walk-in customer. Add the guest as a customer first, then enroll them.", 422); return;
        }
        $m = LoyaltyHelper::run($this->db, fn() => LoyaltyHelper::enroll($this->db, $cid));
        if (!$m) { $this->error('Could not enroll this customer', 500); return; }
        $this->success($this->profile($m, false), 'Customer enrolled');
    }

    public function adjust() {
        $u = $this->guard('promotions.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $cid = (int)($d['customer_id'] ?? 0);
        $pts = (int)($d['points'] ?? 0);
        $reason = trim((string)($d['reason'] ?? ''));
        if (!$pts) { $this->error('Enter the points to add or remove', 422); return; }
        if ($reason === '') { $this->error('Give a reason for the adjustment', 422); return; }
        $m = LoyaltyHelper::memberByCustomer($this->db, $cid);
        if (!$m) { $this->error('Not a member', 404); return; }
        if ((int)$m->points_balance + $pts < 0) { $this->error("The balance is {$m->points_balance}; you can't remove more than that.", 422); return; }
        LoyaltyHelper::post($this->db, (int)$m->id, $pts > 0 ? 'bonus' : 'adjust', $pts, ['note' => $reason, 'user_id' => (int)$u['sub']]);
        if ($pts > 0) LoyaltyHelper::applyUpgrade($this->db, (int)$m->id, LoyaltyHelper::settings($this->db));
        $this->success($this->profile(LoyaltyHelper::memberByCustomer($this->db, $cid), true), 'Points updated');
    }

    public function member_update() {
        $u = $this->guard('promotions.write');
        $d = $this->body();
        $cid = (int)($d['customer_id'] ?? 0);
        $m = LoyaltyHelper::memberByCustomer($this->db, $cid);
        if (!$m) { $this->error('Not a member', 404); return; }
        $sets = []; $binds = [':id' => (int)$m->id];
        if (array_key_exists('tier_id', $d)) {
            $sets[] = 'tier_id = :t'; $binds[':t'] = (int)$d['tier_id'] ?: null;
            // A tier set by hand stays until unlocked
            $sets[] = 'tier_locked = 1';
            if ((int)$d['tier_id'] !== (int)$m->tier_id) {
                LoyaltyHelper::post($this->db, (int)$m->id, 'adjust', 0, ['note' => 'Tier changed by hand' . (!empty($d['reason']) ? ': ' . $d['reason'] : ''), 'user_id' => (int)$u['sub']]);
            }
        }
        if (array_key_exists('tier_locked', $d) && !array_key_exists('tier_id', $d)) { $sets[] = 'tier_locked = :l'; $binds[':l'] = !empty($d['tier_locked']) ? 1 : 0; }
        if (array_key_exists('is_active', $d)) { $sets[] = 'is_active = :a'; $binds[':a'] = !empty($d['is_active']) ? 1 : 0; }
        if ($sets) {
            $this->db->query("UPDATE loyalty_members SET " . implode(', ', $sets) . " WHERE id = :id");
            foreach ($binds as $k => $v) $this->db->bind($k, $v);
            $this->db->execute();
        }
        $this->success($this->profile(LoyaltyHelper::memberByCustomer($this->db, $cid), true), 'Member updated');
    }

    /** POS: small member card for the selected customer. Never errors when the module is off. */
    public function lookup() {
        $this->requirePermission(['pos.read', 'pos.write', 'promotions.read']);
        if (!SaasHelper::isModuleEnabled('loyalty')) { $this->success(['enabled' => false]); return; }
        $s = LoyaltyHelper::settings($this->db);
        if ($s['enabled'] !== '1') { $this->success(['enabled' => false]); return; }
        LoyaltyHelper::runDaily($this->db);
        $cid = (int)($_GET['customer_id'] ?? 0);
        $walkIn = $cid ? LoyaltyHelper::run($this->db, fn() => LoyaltyHelper::isWalkIn($this->db, $cid)) : true;
        $m = $cid && !$walkIn ? LoyaltyHelper::memberByCustomer($this->db, $cid) : null;
        $this->success([
            'enabled' => true,
            'program' => $s['program_name'],
            'walk_in' => $walkIn,
            'auto_enroll' => $s['auto_enroll'] === '1',
            // Redeem rules the POS applies (the server checks them again on the invoice)
            'rules' => [
                'point_value' => (float)$s['point_value'],
                'min_redeem' => (int)$s['min_redeem'],
                'max_redeem_pct' => (int)$s['max_redeem_pct'],
            ],
            'member' => $m ? [
                'member_no' => $m->member_no, 'points' => (int)$m->points_balance, 'tier' => $m->tier_name,
                'tier_color' => $m->tier_color, 'multiplier' => (float)$m->multiplier, 'active' => (bool)$m->is_active,
                'discount_pct' => (float)($m->discount_pct ?? 0),
            ] : null,
        ]);
    }

    /** Admin: run expiry / birthday / tier review now (normally once a day on its own). */
    public function run_jobs() {
        $this->guard('promotions.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $r = LoyaltyHelper::runDaily($this->db, true);
        if ($r === null) { $this->error('Switch the program on first.', 422); return; }
        $this->success($r, 'Loyalty jobs finished');
    }

    /** Reports: 12-month summary, top members, points expiring soon. */
    public function reports() {
        $this->guard('promotions.read');
        $s = LoyaltyHelper::settings($this->db);
        $data = LoyaltyHelper::run($this->db, function () use ($s) {
            $this->db->query("SELECT DATE_FORMAT(created_at, '%Y-%m') ym,
                    SUM(CASE WHEN type IN ('earn','bonus') THEN points ELSE 0 END) earned,
                    SUM(CASE WHEN type = 'redeem' THEN -points ELSE 0 END) redeemed,
                    SUM(CASE WHEN type = 'expire' THEN -points ELSE 0 END) expired,
                    SUM(CASE WHEN type = 'reverse' THEN points ELSE 0 END) reversed,
                    SUM(CASE WHEN type = 'redeem' THEN amount ELSE 0 END) redeemed_value,
                    COUNT(DISTINCT CASE WHEN type = 'earn' THEN invoice_id END) bills
                FROM loyalty_ledger WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
                GROUP BY ym ORDER BY ym");
            $months = $this->db->resultSet() ?: [];

            $this->db->query("SELECT m.customer_id, m.member_no, m.points_balance, m.lifetime_points, c.name, c.phone, t.name tier_name, t.color tier_color,
                    (SELECT COALESCE(SUM(amount),0) FROM loyalty_ledger l WHERE l.member_id = m.id AND l.type = 'earn' AND l.created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)) spend_12m
                FROM loyalty_members m JOIN customers c ON c.id = m.customer_id LEFT JOIN loyalty_tiers t ON t.id = m.tier_id
                WHERE m.is_active = 1 ORDER BY spend_12m DESC LIMIT 20");
            $top = $this->db->resultSet() ?: [];

            $this->db->query("SELECT m.customer_id, m.member_no, c.name, c.phone, m.points_balance,
                    LEAST(m.points_balance, SUM(l.points)) expiring, MIN(l.expires_at) first_expiry
                FROM loyalty_ledger l JOIN loyalty_members m ON m.id = l.member_id JOIN customers c ON c.id = m.customer_id
                WHERE l.type IN ('earn','bonus') AND l.expires_at BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND m.points_balance > 0
                GROUP BY m.id, m.customer_id, m.member_no, c.name, c.phone, m.points_balance ORDER BY first_expiry LIMIT 100");
            $expiring = $this->db->resultSet() ?: [];

            $earnedAll = 0; $redeemedAll = 0;
            foreach ($months as $mo) { $earnedAll += (int)$mo->earned; $redeemedAll += (int)$mo->redeemed; }
            return [
                'months' => $months, 'top' => $top, 'expiring' => $expiring,
                'redemption_rate' => $earnedAll > 0 ? round($redeemedAll / $earnedAll * 100, 1) : 0,
            ];
        });
        $data['point_value'] = (float)$s['point_value'];
        $data['last_daily_run'] = $s['last_daily_run'];
        $this->success($data);
    }

    public function stats() {
        $this->guard('promotions.read');
        $s = LoyaltyHelper::settings($this->db);
        $data = LoyaltyHelper::run($this->db, function () use ($s) {
            $one = function ($sql) { $this->db->query($sql); return $this->db->single(); };
            $members = $one("SELECT COUNT(*) n, COALESCE(SUM(points_balance),0) bal FROM loyalty_members WHERE is_active = 1");
            $month = $one("SELECT COALESCE(SUM(CASE WHEN points > 0 AND type IN ('earn','bonus') THEN points ELSE 0 END),0) earned,
                COALESCE(SUM(CASE WHEN type = 'redeem' THEN -points ELSE 0 END),0) redeemed
                FROM loyalty_ledger WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')");
            $this->db->query("SELECT t.id, t.name, t.color, COUNT(m.id) n FROM loyalty_tiers t
                LEFT JOIN loyalty_members m ON m.tier_id = t.id AND m.is_active = 1 GROUP BY t.id ORDER BY t.threshold");
            $byTier = $this->db->resultSet() ?: [];
            return [
                'members' => (int)$members->n,
                'points_outstanding' => (int)$members->bal,
                'liability' => round((int)$members->bal * (float)$s['point_value'], 2),
                'earned_this_month' => (int)$month->earned,
                'redeemed_this_month' => (int)$month->redeemed,
                'by_tier' => $byTier,
            ];
        });
        $data['enabled'] = $s['enabled'] === '1';
        $data['program'] = $s['program_name'];
        $this->success($data);
    }
}
