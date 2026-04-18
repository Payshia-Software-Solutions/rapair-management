<?php
/**
 * AccountMapping Model
 * Manages links between system events and specific accounts.
 */
class AccountMapping extends Model {
    private $table = 'acc_mappings';

    public function __construct() {
        parent::__construct();
        AccountingSchema::ensure();
    }

    public function getAll() {
        $this->db->query("
            SELECT am.*, a.code as account_code, a.name as account_name 
            FROM {$this->table} am
            JOIN acc_accounts a ON a.id = am.account_id
            ORDER BY am.category, am.label
        ");
        return $this->db->resultSet();
    }

    public function getMapping($key) {
        $this->db->query("SELECT * FROM {$this->table} WHERE map_key = :key LIMIT 1");
        $this->db->bind(':key', $key);
        return $this->db->single();
    }

    public function update($key, $accountId) {
        $this->db->query("UPDATE {$this->table} SET account_id = :aid WHERE map_key = :key");
        $this->db->bind(':aid', (int)$accountId);
        $this->db->bind(':key', $key);
        return $this->db->execute();
    }
}
