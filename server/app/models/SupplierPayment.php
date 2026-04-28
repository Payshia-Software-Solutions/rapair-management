<?php
/**
 * SupplierPayment Model
 */
class SupplierPayment extends Model {
    private $table = 'acc_supplier_payments';

    public function __construct() {
        parent::__construct();
        AccountingSchema::ensure();
    }

    public function create($data) {
        $allocations = isset($data['allocations']) && is_array($data['allocations']) ? $data['allocations'] : [];
        
        try {
            $this->db->beginTransaction();

            $this->db->query("
                INSERT INTO {$this->table} (supplier_id, amount, payment_date, payment_method, reference_no, notes, created_by)
                VALUES (:supplier_id, :amount, :payment_date, :payment_method, :reference_no, :notes, :created_by)
            ");
            $this->db->bind(':supplier_id', $data['supplier_id']);
            $this->db->bind(':amount', $data['amount']);
            $this->db->bind(':payment_date', $data['payment_date'] ?? date('Y-m-d'));
            $this->db->bind(':payment_method', $data['payment_method'] ?? 'Bank Transfer');
            $this->db->bind(':reference_no', $data['reference_no'] ?? null);
            $this->db->bind(':notes', $data['notes'] ?? null);
            $this->db->bind(':created_by', $data['userId']);
            $this->db->execute();
            
            $paymentId = $this->db->lastInsertId();

            // Insert allocations
            foreach ($allocations as $alloc) {
                if (empty($alloc['grn_id']) || (float)$alloc['amount'] <= 0) continue;
                
                $this->db->query("
                    INSERT INTO acc_supplier_payment_allocations (payment_id, grn_id, amount)
                    VALUES (:pid, :gid, :amt)
                ");
                $this->db->bind(':pid', $paymentId);
                $this->db->bind(':gid', $alloc['grn_id']);
                $this->db->bind(':amt', $alloc['amount']);
                $this->db->execute();
            }

            $this->db->commit();

            // Automated Accounting
            require_once '../app/helpers/AccountingHelper.php';
            AccountingHelper::postSupplierPayment($paymentId, $data);
            
            return $paymentId;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("SupplierPayment create failed: " . $e->getMessage());
            return false;
        }
    }

    public function getBySupplier($supplierId) {
        $this->db->query("SELECT * FROM {$this->table} WHERE supplier_id = :sid ORDER BY payment_date DESC");
        $this->db->bind(':sid', $supplierId);
        return $this->db->resultSet();
    }

    public function list($filters = []) {
        $sql = "SELECT p.*, s.name as supplier_name 
                FROM {$this->table} p
                JOIN suppliers s ON p.supplier_id = s.id
                WHERE p.status != 'Cancelled'";
        
        if (!empty($filters['supplier_id'])) $sql .= " AND p.supplier_id = :sid";
        if (!empty($filters['from_date'])) $sql .= " AND p.payment_date >= :from";
        if (!empty($filters['to_date'])) $sql .= " AND p.payment_date <= :to";
        
        $sql .= " ORDER BY p.payment_date DESC, p.id DESC LIMIT 50";
        
        $this->db->query($sql);
        if (!empty($filters['supplier_id'])) $this->db->bind(':sid', $filters['supplier_id']);
        if (!empty($filters['from_date'])) $this->db->bind(':from', $filters['from_date']);
        if (!empty($filters['to_date'])) $this->db->bind(':to', $filters['to_date']);
        
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT p.*, s.name as supplier_name, s.address as supplier_address, s.phone as supplier_phone
            FROM {$this->table} p
            JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = :id
            LIMIT 1
        ");
        $this->db->bind(':id', (int)$id);
        $payment = $this->db->single();
        
        if (!$payment) return null;

        // Fetch allocations
        $this->db->query("
            SELECT a.*, g.grn_number, g.received_at
            FROM acc_supplier_payment_allocations a
            JOIN goods_receive_notes g ON a.grn_id = g.id
            WHERE a.payment_id = :pid
        ");
        $this->db->bind(':pid', (int)$id);
        $payment->allocations = $this->db->resultSet();

        return $payment;
    }
    public function cancel($id, $reason, $userId) {
        $payment = $this->getById($id);
        if (!$payment) return false;
        if ($payment->status === 'Cancelled') return true;

        $this->db->beginTransaction();
        try {
            // 1. Update Payment Status
            $this->db->query("
                UPDATE {$this->table} 
                SET status = 'Cancelled',
                    cancelled_at = NOW(),
                    cancelled_by = :user,
                    cancellation_reason = :reason
                WHERE id = :id
            ");
            $this->db->bind(':user', $userId);
            $this->db->bind(':reason', $reason);
            $this->db->bind(':id', $id);
            $this->db->execute();

            // 2. Reverse Accounting Entries
            require_once 'Journal.php';
            $journal = new Journal();
            $journal->reverseEntries('SupplierPayment', $id, $userId);

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("SupplierPayment cancellation failed: " . $e->getMessage());
            return false;
        }
    }
}
