<?php
/**
 * FiscalController - Manages financial year closing
 */
class FiscalController extends Controller {
    private $db;
    private $journalModel;
    private $accountModel;

    private $accountSettingModel;

    public function __construct() {
        $this->db = new Database();
        $this->journalModel = $this->model('Journal');
        $this->accountModel = $this->model('Account');
        $this->accountSettingModel = $this->model('AccountSetting');
    }

    // GET /api/fiscal/summary?start_date=2024-01-01&end_date=2024-12-31
    public function summary() {
        $u = $this->requirePermission('accounting.write');
        $start = $_GET['start_date'] ?? null;
        $end = $_GET['end_date'] ?? null;
        $id = $_GET['id'] ?? null;

        if ($id) {
            $this->db->query("SELECT start_date, end_date FROM acc_fiscal_periods WHERE id = :id");
            $this->db->bind(':id', (int)$id);
            $p = $this->db->single();
            if ($p) {
                $start = $p->start_date;
                $end = $p->end_date;
            }
        }

        if (!$start || !$end) {
            $this->error('Period details are required');
            return;
        }

        // Get all Income and Expense account balances for the period
        $this->db->query("
            SELECT 
                a.id, a.code, a.name, a.type,
                SUM(i.debit - i.credit) as period_balance
            FROM acc_accounts a
            LEFT JOIN acc_journal_items i ON a.id = i.account_id
            LEFT JOIN acc_journal_entries e ON i.entry_id = e.id
            WHERE e.entry_date BETWEEN :start AND :end
              AND a.type IN ('INCOME', 'EXPENSE')
            GROUP BY a.id
            HAVING period_balance <> 0
        ");
        $this->db->bind(':start', $start);
        $this->db->bind(':end', $end);
        $rows = $this->db->resultSet();

        $income = [];
        $expenses = [];
        $totalIncome = 0;
        $totalExpense = 0;

        foreach ($rows as $r) {
            $val = (float)$r->period_balance;
            if ($r->type === 'INCOME') {
                $income[] = $r;
                $totalIncome += abs($val);
            } else {
                $expenses[] = $r;
                $totalExpense += abs($val);
            }
        }

        $this->success([
            'income' => $income,
            'expenses' => $expenses,
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'net_profit' => $totalIncome - $totalExpense
        ]);
    }

    // POST /api/fiscal/close
    public function close() {
        $u = $this->requirePermission('accounting.write');
        $data = json_decode(file_get_contents('php://input'), true);
        
        $start = $data['start_date'] ?? null;
        $end = $data['end_date'] ?? null;
        $id = $data['id'] ?? null;
        $name = $data['name'] ?? null;

        if ($id && (!$start || !$end)) {
            $this->db->query("SELECT start_date, end_date, name FROM acc_fiscal_periods WHERE id = :id");
            $this->db->bind(':id', (int)$id);
            $p = $this->db->single();
            if ($p) {
                $start = $p->start_date;
                $end = $p->end_date;
                $name = $name ?? $p->name;
            }
        }

        if (!$start || !$end) {
            $this->error('Invalid period selection');
            return;
        }
        $name = $name ?? "Fiscal Year Closing " . date('Y', strtotime($end));

        // 1. Fetch P&L Summary
        $this->db->query("
            SELECT 
                a.id, a.code, a.name, a.type,
                SUM(i.debit - i.credit) as period_balance
            FROM acc_accounts a
            JOIN acc_journal_items i ON a.id = i.account_id
            JOIN acc_journal_entries e ON i.entry_id = e.id
            WHERE e.entry_date BETWEEN :start AND :end
              AND a.type IN ('INCOME', 'EXPENSE')
            GROUP BY a.id
            HAVING period_balance <> 0
        ");
        $this->db->bind(':start', $start);
        $this->db->bind(':end', $end);
        $accounts = $this->db->resultSet();

        if (empty($accounts)) {
            $this->error('No transactions found for this period');
            return;
        }

        $journalItems = [];
        $totalEffect = 0;

        foreach ($accounts as $acc) {
            $bal = (float)$acc->period_balance;
            // To zero out:
            // If balance is positive (Debit > Credit, common for Expense), we need a CREDIT of $bal.
            // If balance is negative (Credit > Debit, common for Income), we need a DEBIT of abs($bal).
            
            if ($bal > 0) {
                // Debit balance -> need Credit to zero
                $journalItems[] = ['account_id' => $acc->id, 'debit' => 0, 'credit' => abs($bal), 'notes' => 'Year-end closing'];
                $totalEffect -= abs($bal); // net credit reduces income summary
            } else {
                // Credit balance -> need Debit to zero
                $journalItems[] = ['account_id' => $acc->id, 'debit' => abs($bal), 'credit' => 0, 'notes' => 'Year-end closing'];
                $totalEffect += abs($bal); // net debit increases income summary
            }
        }

        // The net effect must go to Retained Earnings
        $retainedEarningsId = AccountingHelper::getMappedId('retained_earnings');
        if (!$retainedEarningsId) {
            $this->error('Retained Earnings account not mapped');
            return;
        }

        if ($totalEffect > 0) {
            // Net Profit (TotalIncome > TotalExpense) -> We have a net DEBIT in the closing lines above.
            // So we need a CREDIT to Retained Earnings
            $journalItems[] = ['account_id' => $retainedEarningsId, 'debit' => 0, 'credit' => abs($totalEffect), 'notes' => 'Transfer of Net Profit to Equity'];
        } else if ($totalEffect < 0) {
            // Net Loss -> We have a net CREDIT in the closing lines.
            // So we need a DEBIT to Retained Earnings
            $journalItems[] = ['account_id' => $retainedEarningsId, 'debit' => abs($totalEffect), 'credit' => 0, 'notes' => 'Transfer of Net Loss to Equity'];
        }

        $entryId = $this->journalModel->post([
            'entry_date' => $end,
            'description' => $name,
            'ref_type' => 'FiscalClosing',
            'userId' => (int)$u['sub'],
            'items' => $journalItems
        ]);

        if ($entryId) {
            if ($id) {
                // Update existing record
                $this->db->query("
                    UPDATE acc_fiscal_periods 
                    SET is_closed = 1, closing_entry_id = :entry_id, closed_at = CURRENT_TIMESTAMP, closed_by = :user
                    WHERE id = :id
                ");
                $this->db->bind(':id', (int)$id);
            } else {
                // Create new record
                $this->db->query("
                    INSERT INTO acc_fiscal_periods (name, start_date, end_date, is_closed, closing_entry_id, closed_at, closed_by)
                    VALUES (:name, :start, :end, 1, :entry_id, CURRENT_TIMESTAMP, :user)
                ");
                $this->db->bind(':name', $name);
                $this->db->bind(':start', $start);
                $this->db->bind(':end', $end);
            }
            $this->db->bind(':entry_id', $entryId);
            $this->db->bind(':user', (int)$u['sub']);
            $this->db->execute();

            $this->success(['entry_id' => $entryId], 'Year ended successfully');
        } else {
            $this->error('Failed to post closing entry');
        }
    }

    // GET /api/fiscal/periods
    public function periods() {
        $this->requireAuth();
        $this->db->query("SELECT * FROM acc_fiscal_periods ORDER BY end_date DESC");
        $this->success($this->db->resultSet());
    }

    // POST /api/fiscal/create
    public function create() {
        $u = $this->requirePermission('accounting.write');
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name']) || empty($data['start_date']) || empty($data['end_date'])) {
            $this->error('All fields are required');
            return;
        }

        $this->db->query("
            INSERT INTO acc_fiscal_periods (name, start_date, end_date, is_closed, is_active)
            VALUES (:name, :start, :end, 0, 0)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':start', $data['start_date']);
        $this->db->bind(':end', $data['end_date']);

        if ($this->db->execute()) {
            $this->success(null, 'Fiscal year created successfully');
        } else {
            $this->error('Failed to create fiscal year');
        }
    }

    // POST /api/fiscal/activate
    public function activate() {
        $this->requirePermission('accounting.write');
        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? null;

        if (!$id) {
            $this->error('ID is required');
            return;
        }

        $this->db->beginTransaction();
        try {
            // Reset all
            $this->db->query("UPDATE acc_fiscal_periods SET is_active = 0");
            $this->db->execute();

            // Set active
            $this->db->query("UPDATE acc_fiscal_periods SET is_active = 1 WHERE id = :id");
            $this->db->bind(':id', (int)$id);
            $this->db->execute();

            // Sync with global settings for backward compatibility
            $this->db->query("SELECT start_date, end_date FROM acc_fiscal_periods WHERE id = :id");
            $this->db->bind(':id', (int)$id);
            $p = $this->db->single();
            if ($p) {
                $this->accountSettingModel->update('fy_start', $p->start_date);
                $this->accountSettingModel->update('fy_end', $p->end_date);
            }

            $this->db->commit();
            $this->success(null, 'Fiscal year activated');
        } catch (Exception $e) {
            $this->db->rollBack();
            $this->error($e->getMessage());
        }
    }
}
