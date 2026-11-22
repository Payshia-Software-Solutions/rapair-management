<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Database;

/**
 * Operations dashboard metrics. Everything is computed here, once, with one definition per metric,
 * so the UI never has to derive money figures from raw rows.
 *
 * Assumptions (also returned in the response as `assumptions`):
 *  - Package prices (monthly_price / yearly_price) are in USD, the base of saas_exchange_rates.
 *  - saas_exchange_rates.rate is units of the currency per 1 USD.
 *  - Invoice and payment amounts are in the currency stored on the invoice.
 */
class DashboardController extends Controller {

    private function requireSuperAdmin() {
        if (!isset($_SESSION['admin_id'])) {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Forbidden'], 403);
        }
    }

    /** @return array<string,float> units per 1 USD, keyed by currency code */
    private function rates(Database $db): array {
        $db->query("SELECT currency_code, rate FROM saas_exchange_rates");
        $map = ['USD' => 1.0];
        foreach ($db->resultSet() as $r) {
            $map[strtoupper($r->currency_code)] = (float)$r->rate;
        }
        return $map;
    }

    /** Converts an amount between currencies. Returns null when a rate is missing. */
    private static function convert(float $amount, string $from, string $to, array $rates): ?float {
        $from = strtoupper($from !== '' ? $from : 'USD');
        $to = strtoupper($to);
        if ($from === $to) return $amount;
        if (!isset($rates[$from], $rates[$to]) || $rates[$from] <= 0) return null;
        return $amount / $rates[$from] * $rates[$to];
    }

    // GET /api/admin/dashboard/summary?currency=LKR
    public function summary() {
        $this->requireSuperAdmin();

        $db = new Database();
        $base = strtoupper(preg_replace('/[^A-Za-z]/', '', $_GET['currency'] ?? 'LKR')) ?: 'LKR';
        $rates = $this->rates($db);
        $missing = [];
        $money = function (float $amount, string $from) use ($base, $rates, &$missing) {
            $v = self::convert($amount, $from, $base, $rates);
            if ($v === null) { $missing[strtoupper($from)] = true; return 0.0; }
            return $v;
        };

        $today = date('Y-m-d');
        $in7 = date('Y-m-d', strtotime('+7 days'));
        $monthStart = date('Y-m-01');
        $sixMonthsAgo = date('Y-m-d H:i:s', strtotime('-6 months'));
        $thirtyDaysAgo = date('Y-m-d H:i:s', strtotime('-30 days'));

        // ---- Tenants
        $db->query("SELECT t.id, t.name, t.slug, t.status, t.currency, t.billing_cycle, t.trial_expiry, t.created_at,
                           t.package_id, p.name AS package_name, p.monthly_price, p.yearly_price
                    FROM saas_tenants t
                    LEFT JOIN saas_packages p ON p.id = t.package_id
                    WHERE t.status <> 'Deleted'
                    ORDER BY t.created_at DESC");
        $tenants = $db->resultSet();

        $statusCounts = ['Active' => 0, 'Trial' => 0, 'Suspended' => 0, 'Expired' => 0];
        $mrr = 0.0; $trialEnding = 0; $trialEnded = 0; $newThisMonth = 0;
        $packageCounts = [];
        $liveTenants = 0;
        foreach ($tenants as $t) {
            $statusCounts[$t->status] = ($statusCounts[$t->status] ?? 0) + 1;
            if (in_array($t->status, ['Active', 'Trial'], true)) {
                $liveTenants++;
                $pkg = $t->package_name ?? 'No package';
                $packageCounts[$pkg] = ($packageCounts[$pkg] ?? 0) + 1;
            }
            if ($t->status === 'Active') {
                $yearly = strtolower((string)$t->billing_cycle) === 'yearly';
                $price = $yearly ? ((float)$t->yearly_price / 12) : (float)$t->monthly_price;
                $mrr += $money($price, 'USD');
            }
            if ($t->status === 'Trial' && !empty($t->trial_expiry)) {
                $d = substr($t->trial_expiry, 0, 10);
                if ($d < $today) $trialEnded++;
                elseif ($d <= $in7) $trialEnding++;
            }
            if ($t->created_at >= $monthStart) $newThisMonth++;
        }
        $totalTenants = array_sum($statusCounts);

        // ---- Invoices
        $db->query("SELECT i.amount, i.currency, i.status, i.due_date, i.created_at
                    FROM saas_invoices i JOIN saas_tenants t ON t.id = i.tenant_id
                    WHERE t.status <> 'Deleted'");
        $outstanding = 0.0; $outstandingCount = 0; $overdue = 0.0; $overdueCount = 0;
        $billed6 = 0.0; $paid6 = 0.0;
        foreach ($db->resultSet() as $inv) {
            $amt = (float)$inv->amount;
            $isPaid = $inv->status === 'Paid';
            $isOpen = !in_array($inv->status, ['Paid', 'Cancelled', 'Void'], true);
            if ($isOpen) {
                $outstanding += $money($amt, $inv->currency);
                $outstandingCount++;
                if (!empty($inv->due_date) && substr($inv->due_date, 0, 10) < $today) {
                    $overdue += $money($amt, $inv->currency);
                    $overdueCount++;
                }
            }
            if ($inv->created_at >= $sixMonthsAgo && !in_array($inv->status, ['Cancelled', 'Void'], true)) {
                $billed6 += $money($amt, $inv->currency);
                if ($isPaid) $paid6 += $money($amt, $inv->currency);
            }
        }
        $collectionRate = $billed6 > 0 ? round($paid6 / $billed6 * 100, 1) : null;

        // ---- Payments (collections)
        $db->query("SELECT p.amount, p.created_at, i.currency
                    FROM saas_payments p JOIN saas_invoices i ON i.id = p.invoice_id");
        $collected30 = 0.0; $monthly = [];
        for ($m = 11; $m >= 0; $m--) { $monthly[date('Y-m', strtotime("first day of -$m month"))] = 0.0; }
        foreach ($db->resultSet() as $pay) {
            $v = $money((float)$pay->amount, $pay->currency);
            if ($pay->created_at >= $thirtyDaysAgo) $collected30 += $v;
            $key = substr($pay->created_at, 0, 7);
            if (array_key_exists($key, $monthly)) $monthly[$key] += $v;
        }

        // ---- Requests (ERP inquiries awaiting action)
        $db->query("SELECT COUNT(*) AS c FROM erp_requests WHERE status = 'Pending'");
        $pendingRequests = (int)($db->single()->c ?? 0);

        // ---- Package distribution (live tenants)
        arsort($packageCounts);
        $packages = [];
        foreach ($packageCounts as $name => $count) {
            $packages[] = ['name' => $name, 'count' => $count, 'percent' => $liveTenants ? round($count / $liveTenants * 100, 1) : 0];
        }

        $recent = array_slice(array_map(fn($t) => [
            'id' => (int)$t->id, 'name' => $t->name, 'slug' => $t->slug, 'status' => $t->status,
            'package' => $t->package_name, 'trial_expiry' => $t->trial_expiry, 'created_at' => $t->created_at,
        ], $tenants), 0, 6);

        return $this->json(['status' => 'success', 'data' => [
            'base_currency' => $base,
            'kpis' => [
                'total_tenants' => $totalTenants,
                'active_tenants' => $statusCounts['Active'],
                'trial_tenants' => $statusCounts['Trial'],
                'suspended_tenants' => $statusCounts['Suspended'],
                'expired_tenants' => $statusCounts['Expired'],
                'new_tenants_this_month' => $newThisMonth,
                'mrr' => round($mrr, 2),
                'arr' => round($mrr * 12, 2),
                'collected_30d' => round($collected30, 2),
                'outstanding' => round($outstanding, 2),
                'outstanding_count' => $outstandingCount,
                'overdue' => round($overdue, 2),
                'overdue_count' => $overdueCount,
                'collection_rate_6m' => $collectionRate,
                'pending_requests' => $pendingRequests,
            ],
            'trials' => ['ending_7d' => $trialEnding, 'ended' => $trialEnded],
            'collections_monthly' => array_map(fn($k, $v) => ['month' => $k, 'amount' => round($v, 2)], array_keys($monthly), array_values($monthly)),
            'packages' => $packages,
            'recent_tenants' => $recent,
            'assumptions' => [
                'Package prices are treated as USD.',
                'MRR counts Active tenants only. Yearly plans are divided by 12.',
                'Trial tenants are not in MRR.',
                'Collection rate = paid / billed invoices created in the last 6 months.',
            ],
            'missing_rates' => array_keys($missing),
        ]]);
    }
}
