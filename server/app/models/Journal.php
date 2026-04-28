<?php
/**
 * Journal Model - The Accounting Posting Engine
 */
class Journal extends Model {
    private $table_entries = 'acc_journal_entries';
    private $table_items = 'acc_journal_items';

    public function __construct() {
        parent::__construct();
        AccountingSchema::ensure();
    }

    public function getEntries($filters = []) {
        $sql = "SELECT * FROM {$this->table_entries} WHERE 1=1";
        if (isset($filters['id'])) $sql .= " AND id = :id";
        if (isset($filters['ref_type'])) $sql .= " AND ref_type = :ref_type";
        if (isset($filters['ref_id'])) $sql .= " AND ref_id = :ref_id";
        if (isset($filters['from'])) $sql .= " AND entry_date >= :from";
        if (isset($filters['to'])) $sql .= " AND entry_date <= :to";
        
        $sql .= " ORDER BY entry_date DESC, id DESC";
        
        if (isset($filters['limit'])) {
            $limit = (int)$filters['limit'];
            $offset = (int)($filters['offset'] ?? 0);
            $sql .= " LIMIT $offset, $limit";
        }
        
        $this->db->query($sql);
        if (isset($filters['id'])) $this->db->bind(':id', (int)$filters['id']);
        if (isset($filters['ref_type'])) $this->db->bind(':ref_type', $filters['ref_type']);
        if (isset($filters['ref_id'])) $this->db->bind(':ref_id', (int)$filters['ref_id']);
        if (isset($filters['from'])) $this->db->bind(':from', $filters['from']);
        if (isset($filters['to'])) $this->db->bind(':to', $filters['to']);
        
        return $this->db->resultSet();
    }

    public function countEntries($filters = []) {
        $sql = "SELECT COUNT(*) as total FROM {$this->table_entries} WHERE 1=1";
        if (isset($filters['id'])) $sql .= " AND id = :id";
        if (isset($filters['ref_type'])) $sql .= " AND ref_type = :ref_type";
        if (isset($filters['ref_id'])) $sql .= " AND ref_id = :ref_id";
        if (isset($filters['from'])) $sql .= " AND entry_date >= :from";
        if (isset($filters['to'])) $sql .= " AND entry_date <= :to";
        
        $this->db->query($sql);
        if (isset($filters['id'])) $this->db->bind(':id', (int)$filters['id']);
        if (isset($filters['ref_type'])) $this->db->bind(':ref_type', $filters['ref_type']);
        if (isset($filters['ref_id'])) $this->db->bind(':ref_id', (int)$filters['ref_id']);
        if (isset($filters['from'])) $this->db->bind(':from', $filters['from']);
        if (isset($filters['to'])) $this->db->bind(':to', $filters['to']);
        
        $row = $this->db->single();
        return (int)($row->total ?? 0);
    }

    public function getEntryItems($entryId) {
        $this->db->query("
            SELECT i.*, a.code as account_code, a.name as account_name
            FROM {$this->table_items} i
            JOIN acc_accounts a ON i.account_id = a.id
            WHERE i.entry_id = :id
            ORDER BY i.debit DESC, i.id ASC
        ");
        $this->db->bind(':id', (int)$entryId);
        return $this->db->resultSet();
    }

    /**
     * Post a balanced journal entry
     * $data = [
     *   'entry_date' => 'YYYY-MM-DD',
     *   'description' => '...',
     *   'ref_type' => 'Invoice',
     *   'ref_id' => 123,
     *   'userId' => 1,
     *   'items' => [
     *      ['account_id' => 1, 'debit' => 100, 'credit' => 0, 'notes' => '...'],
     *      ['account_id' => 2, 'debit' => 0, 'credit' => 100, 'notes' => '...']
     *   ]
     * ]
     */
    public function post($data) {
        $items = $data['items'] ?? [];
        if (empty($items)) return false;

        // Validate Balance
        $totalDebit = 0;
        $totalCredit = 0;
        foreach ($items as $item) {
            $totalDebit += (float)($item['debit'] ?? 0);
            $totalCredit += (float)($item['credit'] ?? 0);
        }

        if (abs($totalDebit - $totalCredit) > 0.001) {
            error_log("Journal Posting Error: Out of balance. D: $totalDebit, C: $totalCredit");
            return false;
        }

        // 1. Date Locking Validation (Prevent posting to closed periods)
        $dateStr = $data['entry_date'] ?? date('Y-m-d');
        $this->db->query("
            SELECT id FROM acc_fiscal_periods 
            WHERE is_closed = 1 
              AND :entry_date BETWEEN start_date AND end_date
            LIMIT 1
        ");
        $this->db->bind(':entry_date', $dateStr);
        if ($this->db->single()) {
            error_log("Journal Posting Error: Date $dateStr falls within a CLOSED fiscal period.");
            return false;
        }

        try {
            $this->db->beginTransaction();

            $this->db->query("
                INSERT INTO {$this->table_entries} (entry_date, description, ref_type, ref_id, total_amount, created_by)
                VALUES (:date, :desc, :ref_t, :ref_i, :total, :user)
            ");
            $this->db->bind(':date', $data['entry_date'] ?? date('Y-m-d'));
            $this->db->bind(':desc', $data['description'] ?? '');
            $this->db->bind(':ref_t', $data['ref_type'] ?? null);
            $this->db->bind(':ref_i', $data['ref_id'] ?? null);
            $this->db->bind(':total', $totalDebit);
            $this->db->bind(':user', $data['userId'] ?? null);
            $this->db->execute();
            
            $entryId = $this->db->lastInsertId();
            $accountModel = new Account();

            foreach ($items as $item) {
                if ((float)($item['debit'] ?? 0) == 0 && (float)($item['credit'] ?? 0) == 0) continue;

                $this->db->query("
                    INSERT INTO {$this->table_items} (entry_id, account_id, debit, credit, partner_type, partner_id, notes)
                    VALUES (:entry_id, :acc_id, :debit, :credit, :p_type, :p_id, :notes)
                ");
                $this->db->bind(':entry_id', $entryId);
                $this->db->bind(':acc_id', $item['account_id']);
                $this->db->bind(':debit', $item['debit'] ?? 0);
                $this->db->bind(':credit', $item['credit'] ?? 0);
                $this->db->bind(':p_type', $item['partner_type'] ?? null);
                $this->db->bind(':p_id', $item['partner_id'] ?? null);
                $this->db->bind(':notes', $item['notes'] ?? null);
                $this->db->execute();

                // Update account balance
                $accountModel->updateBalance($item['account_id']);
            }

            $this->db->commit();
            return $entryId;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("Journal Posting Failed: " . $e->getMessage());
            return false;
        }
    }
    
    /**
     * Get detailed ledger for a specific account
     */
    public function getAccountLedger($accountId, $fromDate = null, $toDate = null, $limit = null, $offset = null) {
        $sql = "
            SELECT 
                je.id as entry_id,
                je.entry_date, 
                je.description as entry_desc, 
                je.ref_type, 
                je.ref_id, 
                ji.debit, 
                ji.credit, 
                ji.notes as line_notes
            FROM {$this->table_items} ji
            JOIN {$this->table_entries} je ON ji.entry_id = je.id
            WHERE ji.account_id = :acc_id
        ";

        if ($fromDate) $sql .= " AND je.entry_date >= :from";
        if ($toDate) $sql .= " AND je.entry_date <= :to";
        
        $sql .= " ORDER BY je.entry_date ASC, je.id ASC";

        if ($limit !== null) {
            $limit = (int)$limit;
            $offset = (int)($offset ?? 0);
            $sql .= " LIMIT $offset, $limit";
        }

        $this->db->query($sql);
        $this->db->bind(':acc_id', (int)$accountId);
        if ($fromDate) $this->db->bind(':from', $fromDate);
        if ($toDate) $this->db->bind(':to', $toDate);
        
        return $this->db->resultSet();
    }

    public function countAccountLedger($accountId, $fromDate = null, $toDate = null) {
        $sql = "
            SELECT COUNT(*) as total
            FROM {$this->table_items} ji
            JOIN {$this->table_entries} je ON ji.entry_id = je.id
            WHERE ji.account_id = :acc_id
        ";

        if ($fromDate) $sql .= " AND je.entry_date >= :from";
        if ($toDate) $sql .= " AND je.entry_date <= :to";
        
        $this->db->query($sql);
        $this->db->bind(':acc_id', (int)$accountId);
        if ($fromDate) $this->db->bind(':from', $fromDate);
        if ($toDate) $this->db->bind(':to', $toDate);
        
        $row = $this->db->single();
        return (int)($row->total ?? 0);
    }

    /**
     * Reverses all journal entries associated with a reference.
     * Creates new entries with Debits and Credits swapped.
     */
    public function reverseEntries($refType, $refId, $userId) {
        $entries = $this->getEntries([
            'ref_type' => $refType,
            'ref_id' => $refId
        ]);

        if (empty($entries)) return true;

        $success = true;
        foreach ($entries as $entry) {
            // Skip if already reversed (to avoid loops, though UI should prevent this)
            if (strpos($entry->description, 'REVERSAL:') === 0) continue;

            // Check if this entry has already been reversed by another entry
            $this->db->query("SELECT id FROM {$this->table_entries} WHERE description = :desc AND ref_type = :rt AND ref_id = :ri");
            $this->db->bind(':desc', 'REVERSAL: ' . $entry->description);
            $this->db->bind(':rt', $refType);
            $this->db->bind(':ri', $refId);
            if ($this->db->single()) continue;

            $items = $this->getEntryItems($entry->id);
            $reversalItems = [];

            foreach ($items as $item) {
                $reversalItems[] = [
                    'account_id' => $item->account_id,
                    'debit' => $item->credit, // Swap
                    'credit' => $item->debit, // Swap
                    'partner_type' => $item->partner_type,
                    'partner_id' => $item->partner_id,
                    'notes' => 'Reversal of entry #' . $entry->id
                ];
            }

            $ok = $this->post([
                'entry_date' => date('Y-m-d'),
                'description' => 'REVERSAL: ' . $entry->description,
                'ref_type' => $refType,
                'ref_id' => $refId,
                'userId' => $userId,
                'items' => $reversalItems
            ]);

            if (!$ok) $success = false;
        }

        return $success;
    }
}
