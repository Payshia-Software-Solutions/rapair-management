<?php
/**
 * Account Model
 */
class Account extends Model {
    private $table = 'acc_accounts';

    public function __construct() {
        parent::__construct();
        AccountingSchema::ensure();
    }

    public function getAll($filters = []) {
        $sql = "SELECT * FROM {$this->table} WHERE 1=1";
        if (isset($filters['type'])) {
            $sql .= " AND type = :type";
        }
        if (isset($filters['active'])) {
            $sql .= " AND is_active = :active";
        }
        $sql .= " ORDER BY code ASC";
        
        $this->db->query($sql);
        if (isset($filters['type'])) $this->db->bind(':type', $filters['type']);
        if (isset($filters['active'])) $this->db->bind(':active', (int)$filters['active']);
        
        return $this->db->resultSet();
    }

    public function getByCode($code) {
        $this->db->query("SELECT * FROM {$this->table} WHERE code = :code LIMIT 1");
        $this->db->bind(':code', $code);
        return $this->db->single();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (code, name, type, category, is_system, is_active)
            VALUES (:code, :name, :type, :category, :is_system, :is_active)
        ");
        $this->db->bind(':code', $data['code']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':type', $data['type']);
        $this->db->bind(':category', $data['category'] ?? null);
        $this->db->bind(':is_system', 0);
        $this->db->bind(':is_active', 1);
        
        if ($this->db->execute()) {
            $id = $this->db->lastInsertId();
            
            // Handle Opening Balance
            if (!empty($data['opening_balance']) && (float)$data['opening_balance'] != 0) {
                require_once 'Journal.php';
                $journalModel = new Journal();
                require_once '../app/helpers/AccountingHelper.php';
                
                $obeId = AccountingHelper::getMappedId('opening_balance_equity');
                if ($obeId) {
                    $amount = (float)$data['opening_balance'];
                    $isDebit = in_array($data['type'], ['ASSET', 'EXPENSE']);
                    
                    $items = [];
                    // Main Account Line
                    $items[] = [
                        'account_id' => $id,
                        'debit' => $isDebit ? abs($amount) : 0,
                        'credit' => !$isDebit ? abs($amount) : 0,
                        'notes' => 'Opening Balance Initialization'
                    ];
                    // Equity Offset Line
                    $items[] = [
                        'account_id' => $obeId,
                        'debit' => !$isDebit ? abs($amount) : 0,
                        'credit' => $isDebit ? abs($amount) : 0,
                        'notes' => "Opening Balance Offset - {$data['name']}"
                    ];

                    $journalModel->post([
                        'entry_date' => $data['as_of_date'] ?? date('Y-m-d'),
                        'description' => "Opening Balance for {$data['name']}",
                        'ref_type' => 'OpeningBalance',
                        'ref_id' => $id,
                        'userId' => $data['userId'] ?? null,
                        'items' => $items
                    ]);
                }
            }
            
            return $id;
        }
        return false;
    }

    /**
     * Recalculate account balance based on journal items
     */
    public function updateBalance($accountId) {
        $this->db->query("
            SELECT SUM(debit - credit) as balance 
            FROM acc_journal_items 
            WHERE account_id = :id
        ");
        $this->db->bind(':id', (int)$accountId);
        $row = $this->db->single();
        $balance = $row ? ($row->balance ?? 0) : 0;

        $this->db->query("UPDATE {$this->table} SET balance = :balance WHERE id = :id");
        $this->db->bind(':balance', $balance);
        $this->db->bind(':id', (int)$accountId);
        return $this->db->execute();
    }
    
    /**
     * Get account movements for a specific period
     */
    public function getPeriodActivity($fromDate, $toDate) {
        $this->db->query("
            SELECT 
                a.*,
                COALESCE(mov.period_debit, 0) as period_debit,
                COALESCE(mov.period_credit, 0) as period_credit,
                COALESCE(mov.period_debit - mov.period_credit, 0) as period_balance
            FROM {$this->table} a
            LEFT JOIN (
                SELECT 
                    ji.account_id,
                    SUM(ji.debit) as period_debit,
                    SUM(ji.credit) as period_credit
                FROM acc_journal_items ji
                JOIN acc_journal_entries je ON ji.entry_id = je.id
                WHERE je.entry_date BETWEEN :from AND :to
                GROUP BY ji.account_id
            ) mov ON a.id = mov.account_id
            WHERE a.is_active = 1
            ORDER BY a.code ASC
        ");
        $this->db->bind(':from', $fromDate);
        $this->db->bind(':to', $toDate);
        return $this->db->resultSet();
    }

    /**
     * Get account balances as of a specific date (cumulative)
     */
    public function getBalancesAsOf($date) {
        $this->db->query("
            SELECT 
                a.*,
                COALESCE(mov.cumulative_debit, 0) as cumulative_debit,
                COALESCE(mov.cumulative_credit, 0) as cumulative_credit,
                COALESCE(mov.cumulative_debit - mov.cumulative_credit, 0) as balance
            FROM {$this->table} a
            LEFT JOIN (
                SELECT 
                    ji.account_id,
                    SUM(ji.debit) as cumulative_debit,
                    SUM(ji.credit) as cumulative_credit
                FROM acc_journal_items ji
                JOIN acc_journal_entries je ON ji.entry_id = je.id
                WHERE je.entry_date <= :as_of
                GROUP BY ji.account_id
            ) mov ON a.id = mov.account_id
            WHERE a.is_active = 1
            ORDER BY a.code ASC
        ");
        $this->db->bind(':as_of', $date);
        return $this->db->resultSet();
    }
}
