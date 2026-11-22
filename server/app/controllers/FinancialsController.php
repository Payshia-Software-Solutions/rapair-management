<?php
/**
 * Financial statements built from the journal and the 4-level chart of accounts.
 *
 *   GET /api/financials/pnl?from=&to=[&cfrom=&cto=]              Statement of Profit or Loss
 *   GET /api/financials/balance_sheet?as_of=[&cas_of=]            Statement of Financial Position
 *
 * Amounts are in natural sign: income, liabilities and equity positive when they have their
 * normal credit balance; contra lines (discounts, returns, accumulated depreciation) negative.
 * Every node carries its children so the page can show any level 1–4.
 */
class FinancialsController extends Controller {
    protected $db;
    private $loc = null; // branch filter (null = whole company)

    public function __construct() {
        $this->db = new Database();
    }

    private function d($v, $fallback) {
        return (is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) ? $v : $fallback;
    }

    /** Ledger balances (debit - credit) for a date window; $from null = since the beginning. */
    private function ledgerBalances($from, $to) {
        $sql = "SELECT ji.account_id, SUM(ji.debit - ji.credit) AS v
                FROM acc_journal_items ji JOIN acc_journal_entries je ON je.id = ji.entry_id
                WHERE je.entry_date <= :to" . ($from ? " AND je.entry_date >= :from" : '') . ($this->loc ? " AND je.location_id = :loc" : '') . "
                GROUP BY ji.account_id";
        $this->db->query($sql);
        $this->db->bind(':to', $to);
        if ($from) $this->db->bind(':from', $from);
        if ($this->loc) $this->db->bind(':loc', $this->loc);
        $out = [];
        foreach ($this->db->resultSet() ?: [] as $r) $out[(int)$r->account_id] = (float)$r->v;
        return $out;
    }

    private function accounts() {
        $this->db->query("SELECT id, parent_id, level, is_group, code, name, type FROM acc_accounts WHERE is_active = 1");
        return $this->db->resultSet() ?: [];
    }

    /**
     * Tree for the given account types with up to two value columns.
     * $cols = [ [balances...], [balances...] ]
     */
    private function tree(array $types, array $cols) {
        $nodes = [];
        foreach ($this->accounts() as $a) {
            if (!in_array($a->type, $types, true)) continue;
            $sign = in_array($a->type, ['LIABILITY', 'EQUITY', 'INCOME'], true) ? -1 : 1;
            $vals = [];
            foreach ($cols as $c) $vals[] = (int)$a->is_group ? 0.0 : round(($c[(int)$a->id] ?? 0) * $sign, 2);
            $nodes[(int)$a->id] = [
                'id' => (int)$a->id, 'parent_id' => $a->parent_id ? (int)$a->parent_id : null, 'code' => $a->code,
                'name' => $a->name, 'type' => $a->type, 'level' => (int)$a->level, 'is_group' => (int)$a->is_group,
                'values' => $vals, 'children' => [],
            ];
        }
        $roots = [];
        foreach (array_keys($nodes) as $id) {
            $p = $nodes[$id]['parent_id'];
            if ($p && isset($nodes[$p])) $nodes[$p]['children'][] = &$nodes[$id];
            else $roots[] = &$nodes[$id];
        }
        $roll = function (&$n) use (&$roll) {
            usort($n['children'], fn($a, $b) => strnatcmp($a['code'], $b['code']));
            if ($n['is_group']) {
                $n['values'] = array_fill(0, count($n['values']), 0.0);
                foreach ($n['children'] as &$c) {
                    $roll($c);
                    foreach ($c['values'] as $i => $v) $n['values'][$i] = round($n['values'][$i] + $v, 2);
                }
                unset($c);
            }
            // drop empty branches (all zero) to keep statements tidy
            $n['children'] = array_values(array_filter($n['children'], fn($c) => array_filter($c['values'], fn($v) => abs($v) >= 0.005)));
        };
        foreach ($roots as &$r) $roll($r);
        unset($r);
        usort($roots, fn($a, $b) => strnatcmp($a['code'], $b['code']));
        return $roots;
    }

    private function find(array $roots, $code) {
        foreach ($roots as $r) {
            if ($r['code'] === $code) return $r;
            $f = $this->find($r['children'], $code);
            if ($f) return $f;
        }
        return null;
    }

    private function vals($node, $n) {
        return $node ? $node['values'] : array_fill(0, $n, 0.0);
    }

    private function add(...$arrs) {
        $out = [];
        foreach ($arrs as $a) foreach ($a as $i => $v) $out[$i] = round(($out[$i] ?? 0) + $v, 2);
        return $out;
    }

    private function neg($a) { return array_map(fn($v) => -$v, $a); }

    public function pnl() {
        $this->requirePermission('accounting.read');
        $this->loc = !empty($_GET['location_id']) && $_GET['location_id'] !== 'all' ? (int)$_GET['location_id'] : null;
        $to = $this->d($_GET['to'] ?? null, date('Y-m-d'));
        $from = $this->d($_GET['from'] ?? null, date('Y-m-01', strtotime($to)));
        $cfrom = $this->d($_GET['cfrom'] ?? null, null);
        $cto = $this->d($_GET['cto'] ?? null, null);

        $cols = [$this->ledgerBalances($from, $to)];
        if ($cfrom && $cto) $cols[] = $this->ledgerBalances($cfrom, $cto);
        $n = count($cols);
        $roots = $this->tree(['INCOME', 'EXPENSE'], $cols);

        // Sections follow the standard groups; anything filed elsewhere is caught by "Other"
        $rev = $this->find($roots, '41');
        $oth = $this->find($roots, '42');
        $cos = $this->find($roots, '51');
        $opx = $this->find($roots, '52');
        $fin = $this->find($roots, '53');
        $inc = $this->find($roots, '4');
        $exp = $this->find($roots, '5');

        $revenue = $this->vals($rev, $n);
        $otherIncome = $this->add($this->vals($inc, $n), $this->neg($revenue)); // everything in 4 not under 41
        $costOfSales = $this->vals($cos, $n);
        $operating = $this->vals($opx, $n);
        $finance = $this->vals($fin, $n);
        $otherExp = $this->add($this->vals($exp, $n), $this->neg($costOfSales), $this->neg($operating), $this->neg($finance));

        $gross = $this->add($revenue, $this->neg($costOfSales));
        $opProfit = $this->add($gross, $this->neg($operating), $this->neg($otherExp));
        $net = $this->add($opProfit, $otherIncome, $this->neg($finance));

        $section = fn($key, $label, $node, $vals, $kind) => ['key' => $key, 'label' => $label, 'kind' => $kind, 'values' => $vals, 'lines' => $node ? $node['children'] : []];
        $this->success([
            'period' => ['from' => $from, 'to' => $to, 'cfrom' => $cfrom, 'cto' => $cto],
            'sections' => [
                $section('revenue', 'Revenue', $rev, $revenue, 'income'),
                $section('cos', 'Cost of sales', $cos, $costOfSales, 'expense'),
                ['key' => 'gross', 'label' => 'Gross profit', 'kind' => 'total', 'values' => $gross],
                $section('opex', 'Operating expenses', $opx, $operating, 'expense'),
                ...(array_filter($otherExp, fn($v) => abs($v) >= 0.005) ? [['key' => 'otherexp', 'label' => 'Other expenses', 'kind' => 'expense', 'values' => $otherExp, 'lines' => []]] : []),
                ['key' => 'op', 'label' => 'Operating profit', 'kind' => 'total', 'values' => $opProfit],
                $section('other', 'Other income', $oth, $otherIncome, 'income'),
                $section('finance', 'Finance costs', $fin, $finance, 'expense'),
                ['key' => 'net', 'label' => 'Net profit / (loss) for the period', 'kind' => 'grand', 'values' => $net],
            ],
            'margins' => [
                'gross' => array_map(fn($g, $r) => $r ? round($g / $r * 100, 1) : null, $gross, $revenue),
                'net' => array_map(fn($g, $r) => $r ? round($g / $r * 100, 1) : null, $net, $revenue),
            ],
        ]);
    }

    public function balance_sheet() {
        $this->requirePermission('accounting.read');
        $this->loc = !empty($_GET['location_id']) && $_GET['location_id'] !== 'all' ? (int)$_GET['location_id'] : null;
        $asOf = $this->d($_GET['as_of'] ?? null, date('Y-m-d'));
        $cAsOf = $this->d($_GET['cas_of'] ?? null, null);

        $cols = [$this->ledgerBalances(null, $asOf)];
        if ($cAsOf) $cols[] = $this->ledgerBalances(null, $cAsOf);
        $n = count($cols);

        $assets = $this->tree(['ASSET'], $cols);
        $liab = $this->tree(['LIABILITY'], $cols);
        $equity = $this->tree(['EQUITY'], $cols);
        // Profit not yet closed into retained earnings = all income less all expenses to date
        $pl = $this->tree(['INCOME', 'EXPENSE'], $cols);
        $inc = $this->find($pl, '4');
        $exp = $this->find($pl, '5');
        $unclosed = $this->add($this->vals($inc, $n), $this->neg($this->vals($exp, $n)));

        $sum = fn($roots) => $this->add(...array_map(fn($r) => $r['values'], $roots ?: [['values' => array_fill(0, $n, 0.0)]]));
        $tA = $sum($assets);
        $tL = $sum($liab);
        $tE = $this->add($sum($equity), $unclosed);
        $tLE = $this->add($tL, $tE);

        $this->success([
            'as_of' => $asOf, 'cas_of' => $cAsOf,
            'assets' => ['lines' => $assets[0]['children'] ?? [], 'total' => $tA],
            'liabilities' => ['lines' => $liab[0]['children'] ?? [], 'total' => $tL],
            'equity' => ['lines' => $equity[0]['children'] ?? [], 'profit' => $unclosed, 'total' => $tE],
            'total_le' => $tLE,
            'balanced' => array_map(fn($a, $b) => abs($a - $b) < 0.01, $tA, $tLE),
        ]);
    }

    // GET /api/financials/card_clearing — card money taken but not yet settled by the bank
    public function card_clearing() {
        $this->requirePermission('accounting.read');
        require_once '../app/helpers/AccountingSchema.php';
        require_once '../app/helpers/AccountingHelper.php';
        $acc = AccountingHelper::getMappedId('payment_card');
        if (!$acc) { $this->success(['balance' => 0, 'by_day' => [], 'settlements' => [], 'banks' => []]); return; }

        $this->db->query("SELECT COALESCE(SUM(debit - credit), 0) AS b FROM acc_journal_items WHERE account_id = :a");
        $this->db->bind(':a', $acc);
        $balance = round((float)$this->db->single()->b, 2);

        $this->db->query("SELECT je.entry_date AS day, SUM(ji.debit) AS taken
                          FROM acc_journal_items ji JOIN acc_journal_entries je ON je.id = ji.entry_id
                          WHERE ji.account_id = :a AND ji.debit > 0 GROUP BY je.entry_date ORDER BY je.entry_date DESC LIMIT 31");
        $this->db->bind(':a', $acc);
        $byDay = $this->db->resultSet() ?: [];

        $this->db->query("SELECT je.id, je.entry_date, je.description, ji.credit AS gross
                          FROM acc_journal_entries je JOIN acc_journal_items ji ON ji.entry_id = je.id AND ji.account_id = :a
                          WHERE je.ref_type = 'CardSettlement' ORDER BY je.id DESC LIMIT 20");
        $this->db->bind(':a', $acc);
        $settlements = $this->db->resultSet() ?: [];

        $this->db->query("SELECT id, code, name FROM acc_accounts WHERE COALESCE(is_group,0) = 0 AND is_active = 1 AND category = 'Bank' ORDER BY code");
        $banks = $this->db->resultSet() ?: [];

        $this->success(['balance' => $balance, 'by_day' => $byDay, 'settlements' => $settlements, 'banks' => $banks]);
    }

    // POST /api/financials/card_settlement { date, gross, commission, bank_account_id, reference, location_id }
    public function card_settlement() {
        $u = $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        require_once '../app/helpers/AccountingSchema.php';
        require_once '../app/helpers/AccountingHelper.php';
        $b = json_decode(file_get_contents('php://input'), true) ?: [];
        $gross = (float)($b['gross'] ?? 0);
        $fee = (float)($b['commission'] ?? 0);
        if ($gross <= 0) { $this->error('Enter the settled amount', 422); return; }
        if ($fee < 0 || $fee >= $gross) { $this->error('Commission must be less than the settled amount', 422); return; }
        $id = AccountingHelper::postCardSettlement($b + ['userId' => (int)$u['sub']]);
        if (!$id) { $this->error("Couldn't post the settlement. Check the Card Clearing mapping and that the date isn't in a closed period.", 422); return; }
        $this->success(['entry_id' => $id], 'Settlement posted');
    }
}
