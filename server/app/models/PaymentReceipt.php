<?php
class PaymentReceipt {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    // ── Schema Bootstrap ────────────────────────────────────────────────────
    public function ensureSchema() {
        // payment_receipts
        $this->db->query("
            CREATE TABLE IF NOT EXISTS payment_receipts (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                receipt_no      VARCHAR(30) NOT NULL UNIQUE,
                invoice_id      INT NOT NULL,
                invoice_no      VARCHAR(30) NOT NULL,
                customer_id     INT NOT NULL,
                customer_name   VARCHAR(150) NOT NULL DEFAULT '',
                location_id     INT NOT NULL DEFAULT 1,
                amount          DECIMAL(12,2) NOT NULL,
                payment_method  VARCHAR(50) NOT NULL DEFAULT 'Cash',
                reference_no    VARCHAR(100) NULL,
                payment_date    DATE NOT NULL,
                notes           TEXT NULL,
                card_type       VARCHAR(20) NULL,
                card_last4      VARCHAR(4) NULL,
                card_auth_code  VARCHAR(50) NULL,
                created_by      INT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pr_invoice   (invoice_id),
                INDEX idx_pr_customer  (customer_id),
                INDEX idx_pr_date      (payment_date)
            )
        ");
        $this->db->execute();

        // Migration Check: Add Card columns if they don't exist
        try {
            $this->db->query("SELECT card_type FROM payment_receipts LIMIT 1");
            $this->db->execute();
        } catch (Exception $e) {
            $this->db->query("ALTER TABLE payment_receipts ADD COLUMN card_type VARCHAR(20) NULL AFTER notes, ADD COLUMN card_last4 VARCHAR(4) NULL AFTER card_type, ADD COLUMN card_auth_code VARCHAR(50) NULL AFTER card_last4");
            $this->db->execute();
        }

        // Migration Check: Add location_id if it doesn't exist
        try {
            $this->db->query("SELECT location_id FROM payment_receipts LIMIT 1");
            $this->db->execute();
        } catch (Exception $e) {
            $this->db->query("ALTER TABLE payment_receipts ADD COLUMN location_id INT NOT NULL DEFAULT 1 AFTER customer_name");
            $this->db->execute();
            $this->db->query("CREATE INDEX idx_pr_location ON payment_receipts(location_id)");
            $this->db->execute();
        }

        // cheque_inventory
        $this->db->query("
            CREATE TABLE IF NOT EXISTS cheque_inventory (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                receipt_id      INT NOT NULL,
                cheque_no_last6 CHAR(6) NOT NULL,
                bank_name       VARCHAR(100) NOT NULL DEFAULT '',
                branch_name     VARCHAR(100) NOT NULL DEFAULT '',
                cheque_date     DATE NOT NULL,
                payee_name      VARCHAR(150) NOT NULL DEFAULT '',
                amount          DECIMAL(12,2) NOT NULL,
                status          ENUM('Pending','Cleared','Bounced','Cancelled') NOT NULL DEFAULT 'Pending',
                cleared_date    DATE NULL,
                notes           TEXT NULL,
                created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ci_receipt (receipt_id),
                INDEX idx_ci_status  (status)
            )
        ");
        $this->db->execute();

        // Seed RCP sequence if not present
        $this->db->query("INSERT IGNORE INTO document_sequences (doc_type, prefix, next_number, padding) VALUES ('RCP', 'RCP-', 1, 5)");
        $this->db->execute();

        return true;
    }

    // ── Receipt Number Generation ────────────────────────────────────────────
    private function generateReceiptNo() {
        $this->db->query("SELECT next_number, prefix, padding FROM document_sequences WHERE doc_type = 'RCP' FOR UPDATE");
        $row = $this->db->single();
        if (!$row) {
            $this->db->query("INSERT IGNORE INTO document_sequences (doc_type, prefix, next_number, padding) VALUES ('RCP', 'RCP-', 1, 5)");
            $this->db->execute();
            $next = 1;
            $prefix = 'RCP-';
            $padding = 5;
        } else {
            $next    = intval($row->next_number);
            $prefix  = $row->prefix;
            $padding = intval($row->padding);
        }

        $this->db->query("UPDATE document_sequences SET next_number = :next, updated_at = NOW() WHERE doc_type = 'RCP'");
        $this->db->bind(':next', $next + 1);
        $this->db->execute();

        return $prefix . str_pad($next, $padding, '0', STR_PAD_LEFT);
    }

    // ── Create Receipt (+ optional Cheque) ──────────────────────────────────
    public function create($data) {
        $receiptNo = $this->generateReceiptNo();

        $this->db->query("
            INSERT INTO payment_receipts
                (receipt_no, invoice_id, invoice_no, customer_id, customer_name, location_id,
                 amount, payment_method, reference_no, payment_date, notes, card_type, card_last4, card_auth_code, created_by)
            VALUES
                (:receipt_no, :invoice_id, :invoice_no, :customer_id, :customer_name, :location_id,
                 :amount, :payment_method, :reference_no, :payment_date, :notes, :card_type, :card_last4, :card_auth_code, :created_by)
        ");
        $this->db->bind(':receipt_no',      $receiptNo);
        $this->db->bind(':invoice_id',      $data['invoice_id']);
        $this->db->bind(':invoice_no',      $data['invoice_no'] ?? '');
        $this->db->bind(':customer_id',     $data['customer_id']);
        $this->db->bind(':customer_name',   $data['customer_name'] ?? '');
        $this->db->bind(':location_id',     $data['location_id'] ?? 1);
        $this->db->bind(':amount',          $data['amount']);
        $this->db->bind(':payment_method',  $data['payment_method'] ?? 'Cash');
        $this->db->bind(':reference_no',    $data['reference_no'] ?? null);
        $this->db->bind(':payment_date',    $data['payment_date']);
        $this->db->bind(':notes',           $data['notes'] ?? null);
        $this->db->bind(':card_type',       $data['card_type'] ?? null);
        $this->db->bind(':card_last4',      $data['card_last4'] ?? null);
        $this->db->bind(':card_auth_code',  $data['card_auth_code'] ?? null);
        $this->db->bind(':created_by',      $data['created_by'] ?? null);

        if (!$this->db->execute()) return false;

        $receiptId = $this->db->lastInsertId();

        // If cheque payment, record in cheque_inventory
        if (($data['payment_method'] ?? '') === 'Cheque' && !empty($data['cheque'])) {
            $c = $data['cheque'];
            $this->db->query("
                INSERT INTO cheque_inventory
                    (receipt_id, cheque_no_last6, bank_name, branch_name, cheque_date, payee_name, amount, notes)
                VALUES
                    (:receipt_id, :last6, :bank, :branch, :cheque_date, :payee, :amount, :notes)
            ");
            $this->db->bind(':receipt_id',  $receiptId);
            $this->db->bind(':last6',       substr($c['cheque_no'] ?? '', -6));
            $this->db->bind(':bank',        $c['bank_name'] ?? '');
            $this->db->bind(':branch',      $c['branch_name'] ?? '');
            $this->db->bind(':cheque_date', $c['cheque_date'] ?? date('Y-m-d'));
            $this->db->bind(':payee',       $c['payee_name'] ?? '');
            $this->db->bind(':amount',      $data['amount']);
            $this->db->bind(':notes',       $c['notes'] ?? null);
            $this->db->execute();
        }

        // Also mirror into invoice_payments for backwards compatibility
        $this->db->query("
            INSERT INTO invoice_payments
                (invoice_id, amount, payment_date, payment_method, reference_no, notes, created_by)
            VALUES
                (:invoice_id, :amount, :payment_date, :payment_method, :reference_no, :notes, :created_by)
        ");
        $this->db->bind(':invoice_id',     $data['invoice_id']);
        $this->db->bind(':amount',         $data['amount']);
        $this->db->bind(':payment_date',   $data['payment_date']);
        $this->db->bind(':payment_method', $data['payment_method'] ?? 'Cash');
        $this->db->bind(':reference_no',   $data['reference_no'] ?? null);
        $this->db->bind(':notes',          $data['notes'] ?? null);
        $this->db->bind(':created_by',     $data['created_by'] ?? null);
        $this->db->execute();

        // Update invoice paid status
        $this->updatePaidStatus($data['invoice_id']);

        return $receiptNo;
    }

    // ── Invoice Paid Status ──────────────────────────────────────────────────
    private function updatePaidStatus($invoiceId) {
        $this->db->query("SELECT COALESCE(SUM(amount),0) as total_paid FROM payment_receipts WHERE invoice_id = :id");
        $this->db->bind(':id', $invoiceId);
        $row = $this->db->single();
        $totalPaid = $row ? floatval($row->total_paid) : 0;

        $this->db->query("SELECT grand_total FROM invoices WHERE id = :id");
        $this->db->bind(':id', $invoiceId);
        $inv = $this->db->single();
        $grandTotal = $inv ? floatval($inv->grand_total) : 0;

        if ($totalPaid >= $grandTotal && $grandTotal > 0) {
            $status = 'Paid';
        } elseif ($totalPaid > 0) {
            $status = 'Partial';
        } else {
            $status = 'Unpaid';
        }

        $this->db->query("UPDATE invoices SET paid_amount = :paid, status = :status WHERE id = :id");
        $this->db->bind(':paid',   $totalPaid);
        $this->db->bind(':status', $status);
        $this->db->bind(':id',     $invoiceId);
        $this->db->execute();
    }

    // ── Get by Invoice ───────────────────────────────────────────────────────
    public function getByInvoice($invoiceId) {
        $this->db->query("
            SELECT pr.*, ci.cheque_no_last6, ci.bank_name, ci.branch_name, ci.cheque_date, ci.payee_name, ci.status as cheque_status
            FROM payment_receipts pr
            LEFT JOIN cheque_inventory ci ON ci.receipt_id = pr.id
            WHERE pr.invoice_id = :id
            ORDER BY pr.created_at ASC
        ");
        $this->db->bind(':id', $invoiceId);
        return $this->db->resultSet();
    }

    // ── Get Single Receipt ───────────────────────────────────────────────────
    public function getById($id) {
        $this->db->query("
            SELECT pr.*, ci.cheque_no_last6, ci.bank_name, ci.branch_name, ci.cheque_date,
                   ci.payee_name, ci.status as cheque_status, ci.cleared_date, ci.id as cheque_id
            FROM payment_receipts pr
            LEFT JOIN cheque_inventory ci ON ci.receipt_id = pr.id
            WHERE pr.id = :id LIMIT 1
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    // ── List All Receipts ────────────────────────────────────────────────────
    public function listAll($filters = []) {
        $where = [];
        $binds = [];

        if (!empty($filters['method'])) {
            $where[] = "pr.payment_method = :method";
            $binds[':method'] = $filters['method'];
        }
        if (!empty($filters['from_date'])) {
            $where[] = "pr.payment_date >= :from_date";
            $binds[':from_date'] = $filters['from_date'];
        }
        if (!empty($filters['to_date'])) {
            $where[] = "pr.payment_date <= :to_date";
            $binds[':to_date'] = $filters['to_date'];
        }
        if (!empty($filters['customer_id'])) {
            $where[] = "pr.customer_id = :customer_id";
            $binds[':customer_id'] = $filters['customer_id'];
        }

        $whereStr = $where ? 'WHERE ' . implode(' AND ', $where) : '';

        $this->db->query("
            SELECT pr.*, ci.cheque_no_last6, ci.bank_name, ci.status as cheque_status
            FROM payment_receipts pr
            LEFT JOIN cheque_inventory ci ON ci.receipt_id = pr.id
            {$whereStr}
            ORDER BY pr.created_at DESC
            LIMIT 200
        ");
        foreach ($binds as $k => $v) $this->db->bind($k, $v);
        return $this->db->resultSet();
    }

    // ── Cheque Inventory List ────────────────────────────────────────────────
    public function listCheques($status = null) {
        $where = $status ? "WHERE ci.status = :status" : "";
        $this->db->query("
            SELECT ci.*, pr.receipt_no, pr.invoice_no, pr.customer_name, pr.payment_date
            FROM cheque_inventory ci
            JOIN payment_receipts pr ON pr.id = ci.receipt_id
            {$where}
            ORDER BY ci.cheque_date ASC
        ");
        if ($status) $this->db->bind(':status', $status);
        return $this->db->resultSet();
    }

    // ── Update Cheque Status ─────────────────────────────────────────────────
    public function updateChequeStatus($chequeId, $status, $clearedDate = null) {
        $this->db->query("UPDATE cheque_inventory SET status = :status, cleared_date = :cleared WHERE id = :id");
        $this->db->bind(':status',  $status);
        $this->db->bind(':cleared', $clearedDate);
        $this->db->bind(':id',      $chequeId);
        return $this->db->execute();
    }
}
