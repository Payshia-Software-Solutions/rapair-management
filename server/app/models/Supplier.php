<?php
/**
 * Supplier Model
 */
class Supplier extends Model {
    private $table = 'suppliers';

    private function ensureSchema() {
        InventorySchema::ensure();
    }

    public function list($q = '') {
        $this->ensureSchema();
        $q = is_string($q) ? trim($q) : '';
        if ($q !== '') {
            $this->db->query("
                SELECT *
                FROM {$this->table}
                WHERE name LIKE :q OR email LIKE :q OR phone LIKE :q
                ORDER BY name ASC
            ");
            $this->db->bind(':q', '%' . $q . '%');
            return $this->db->resultSet();
        }
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->ensureSchema();
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        $row = $this->db->single();
        if (!$row) return null;

        // Attach configured taxes for this supplier
        try {
            $this->db->query("
                SELECT t.*
                FROM supplier_taxes st
                INNER JOIN taxes t ON t.id = st.tax_id
                WHERE st.supplier_id = :sid
                ORDER BY t.sort_order ASC, t.code ASC
            ");
            $this->db->bind(':sid', (int)$id);
            $taxes = $this->db->resultSet();
        } catch (Exception $e) {
            $taxes = [];
        }
        $taxIds = array_map(function($t) { return (int)$t->id; }, $taxes ?: []);

        $row->tax_ids = $taxIds;
        $row->taxes = $taxes ?: [];
        return $row;
    }

    public function setTaxes($supplierId, $taxIds = [], $userId = null) {
        $this->ensureSchema();
        $sid = (int)$supplierId;
        if ($sid <= 0) return false;
        $ids = array_values(array_unique(array_filter(array_map('intval', (array)$taxIds), function($x) { return $x > 0; })));

        try {
            $this->db->exec("START TRANSACTION");
            $this->db->query("DELETE FROM supplier_taxes WHERE supplier_id = :sid");
            $this->db->bind(':sid', $sid);
            $this->db->execute();

            foreach ($ids as $tid) {
                $this->db->query("INSERT IGNORE INTO supplier_taxes (supplier_id, tax_id, created_by) VALUES (:sid, :tid, :u)");
                $this->db->bind(':sid', $sid);
                $this->db->bind(':tid', (int)$tid);
                $this->db->bind(':u', $userId);
                $this->db->execute();
            }
            $this->db->exec("COMMIT");
            return true;
        } catch (Exception $e) {
            try { $this->db->exec("ROLLBACK"); } catch (Exception $e2) {}
            return false;
        }
    }

    public function create($data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            INSERT INTO {$this->table} (name, email, phone, address, tax_reg_no, is_active, created_by, updated_by)
            VALUES (:name, :email, :phone, :address, :tax_reg_no, :is_active, :created_by, :updated_by)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':tax_reg_no', $data['tax_reg_no'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        $ok = $this->db->execute();
        if (!$ok) return false;
        $id = (int)$this->db->lastInsertId();
        return $id > 0 ? $id : true;
    }

    public function update($id, $data, $userId = null) {
        $this->ensureSchema();
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name,
                email = :email,
                phone = :phone,
                address = :address,
                tax_reg_no = :tax_reg_no,
                is_active = :is_active,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':tax_reg_no', $data['tax_reg_no'] ?? null);
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)(bool)$data['is_active'] : 1);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->ensureSchema();
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function getPayableSummary($id) {
        $this->ensureSchema();
        $sid = (int)$id;
        
        // 1. Get Total Balance from Ledger
        require_once '../app/models/AccountMapping.php';
        $mappingModel = new AccountMapping();
        $apMapping = $mappingModel->getMapping('grn_ap');
        $apId = $apMapping ? (int)$apMapping->account_id : null;
        
        $totalBalance = 0;
        if ($apId) {
            $this->db->query("
                SELECT SUM(credit - debit) as balance 
                FROM acc_journal_items 
                WHERE account_id = :aid AND partner_type = 'Supplier' AND partner_id = :sid
            ");
            $this->db->bind(':aid', $apId);
            $this->db->bind(':sid', $sid);
            $res = $this->db->single();
            $totalBalance = (float)($res->balance ?? 0);
        }

        // 2. Get Outstanding GRNs
        // We calculate balance as: total_amount - (sum of allocated payments from multiple payment entries) - (sum of allocated returns)
        $this->db->query("
            SELECT g.id, g.grn_number, g.received_at, g.total_amount,
                   COALESCE((SELECT SUM(amount) FROM acc_supplier_payment_allocations WHERE grn_id = g.id), 0) as paid_amount,
                   COALESCE((SELECT SUM(total_amount) FROM acc_purchase_returns WHERE grn_id = g.id), 0) as returned_amount
            FROM goods_receive_notes g
            WHERE g.supplier_id = :sid
            HAVING (total_amount - paid_amount - returned_amount) > 0.01
            ORDER BY g.received_at ASC
        ");
        $this->db->bind(':sid', $sid);
        $grns = $this->db->resultSet();

        // 3. Get Unallocated Payments (Advances)
        $this->db->query("
            SELECT SUM(p.amount - COALESCE((SELECT SUM(amount) FROM acc_supplier_payment_allocations WHERE payment_id = p.id), 0)) as advance_balance
            FROM acc_supplier_payments p
            WHERE p.supplier_id = :sid
        ");
        $this->db->bind(':sid', $sid);
        $advRes = $this->db->single();
        $advanceBalance = (float)($advRes->advance_balance ?? 0);

        return (object)[
            'total_payable' => $totalBalance,
            'advance_balance' => $advanceBalance,
            'outstanding_grns' => $grns
        ];
    }
}
