<?php
/**
 * Reconciliation Model
 */
class Reconciliation extends Model {
    private $table = 'acc_reconciliations';

    public function __construct() {
        parent::__construct();
    }

    public function getUnreconciledItems($accountId) {
        $this->db->query("
            SELECT 
                ji.id,
                je.entry_date,
                je.description as entry_description,
                ji.notes,
                ji.debit,
                ji.credit,
                je.ref_type,
                je.ref_id
            FROM acc_journal_items ji
            JOIN acc_journal_entries je ON ji.entry_id = je.id
            WHERE ji.account_id = :account_id
            AND ji.reconciled_at IS NULL
            ORDER BY je.entry_date ASC, ji.id ASC
        ");
        $this->db->bind(':account_id', (int)$accountId);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (account_id, statement_date, statement_balance, cleared_balance, difference, is_finalized, created_by)
            VALUES (:account_id, :statement_date, :statement_balance, :cleared_balance, :difference, :is_finalized, :created_by)
        ");
        $this->db->bind(':account_id', $data['account_id']);
        $this->db->bind(':statement_date', $data['statement_date']);
        $this->db->bind(':statement_balance', $data['statement_balance']);
        $this->db->bind(':cleared_balance', $data['cleared_balance']);
        $this->db->bind(':difference', $data['difference']);
        $this->db->bind(':is_finalized', $data['is_finalized'] ?? 0);
        $this->db->bind(':created_by', $data['userId'] ?? null);

        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function finalizeItems($itemIds, $reconciliationDate) {
        if (empty($itemIds)) return true;
        
        $placeholders = implode(',', array_fill(0, count($itemIds), '?'));
        $sql = "UPDATE acc_journal_items SET reconciled_at = ? WHERE id IN ($placeholders)";
        
        $this->db->query($sql);
        $this->db->bind(1, $reconciliationDate);
        foreach ($itemIds as $key => $id) {
            $this->db->bind($key + 2, (int)$id);
        }
        
        return $this->db->execute();
    }

    public function getHistory($accountId) {
        $this->db->query("SELECT * FROM {$this->table} WHERE account_id = :id ORDER BY statement_date DESC");
        $this->db->bind(':id', (int)$accountId);
        return $this->db->resultSet();
    }
}
