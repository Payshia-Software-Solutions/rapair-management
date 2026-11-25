<?php
namespace App\Models;

use App\Core\Database;

class SaaSInvoiceModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /** All invoices with tenant, plan, amount paid and balance. */
    public function getAllWithTenants() {
        $this->db->query("
            SELECT i.*, t.name as tenant_name, t.admin_email, t.billing_cc_email, t.status as tenant_status, p.name as package_name,
                   COALESCE(pp.paid, 0) AS paid_total,
                   CASE WHEN i.status = 'Cancelled' THEN 0 ELSE GREATEST(i.amount - COALESCE(pp.paid, 0), 0) END AS balance,
                   COALESCE(pp.n, 0) AS payment_count
            FROM saas_invoices i
            LEFT JOIN saas_tenants t ON i.tenant_id = t.id
            LEFT JOIN saas_packages p ON t.package_id = p.id
            LEFT JOIN (SELECT invoice_id, SUM(amount) AS paid, COUNT(*) AS n FROM saas_payments GROUP BY invoice_id) pp ON pp.invoice_id = i.id
            ORDER BY i.created_at DESC, i.id DESC
        ");
        return $this->db->resultSet();
    }

    public function listAll() { return $this->getAllWithTenants(); }

    /**
     * One invoice with tenant details, totals and one payment (the given one, or the latest) for receipts.
     * base_price is the plan's USD price for the invoice's cycle.
     */
    public function getFullDetail($id, $paymentId = null) {
        $this->db->query("
            SELECT i.*, t.name as tenant_name, t.admin_email, t.billing_cc_email, t.address, p.name as package_name,
                   CASE WHEN i.billing_month LIKE 'Annual%' THEN COALESCE(NULLIF(p.yearly_price, 0), ROUND(p.monthly_price * 12 * 0.8, 2)) ELSE p.monthly_price END as base_price,
                   (SELECT COALESCE(SUM(amount), 0) FROM saas_payments WHERE invoice_id = i.id) AS paid_total,
                   pay.id AS payment_id, pay.receipt_number, pay.payment_method, pay.transaction_id, pay.amount AS payment_amount, pay.created_at as paid_at
            FROM saas_invoices i
            JOIN saas_tenants t ON i.tenant_id = t.id
            LEFT JOIN saas_packages p ON t.package_id = p.id
            LEFT JOIN saas_payments pay ON pay.id = (
                SELECT id FROM saas_payments WHERE invoice_id = i.id " . ($paymentId ? "AND id = :pid " : "") . "ORDER BY created_at DESC, id DESC LIMIT 1
            )
            WHERE i.id = :id
        ");
        $this->db->bind(':id', (int)$id);
        if ($paymentId) $this->db->bind(':pid', (int)$paymentId);
        $row = $this->db->single();
        if ($row) {
            $row->paid_total = (float)$row->paid_total;
            $row->balance = $row->status === 'Cancelled' ? 0.0 : max(0, round((float)$row->amount - $row->paid_total, 2));
        }
        return $row ?: null;
    }

    /** Columns callers may change. Anything else is ignored, so a request body can never name a column. */
    const UPDATABLE = ['invoice_number', 'billing_month', 'amount', 'due_date', 'status', 'email_status', 'last_sent_at'];

    public function update($id, $data) {
        $data = array_intersect_key($data, array_flip(self::UPDATABLE));
        if (!$data) return false;
        $fields = [];
        $params = [':id' => $id];
        foreach ($data as $key => $val) {
            $fields[] = "$key = :$key";
            $params[":$key"] = $val;
        }
        $query = "UPDATE saas_invoices SET " . implode(', ', $fields) . " WHERE id = :id";
        $this->db->query($query);
        foreach ($params as $key => $val) {
            $this->db->bind($key, $val);
        }
        return $this->db->execute();
    }

    public function getByTenant($tenantId) {
        $this->db->query("SELECT * FROM saas_invoices WHERE tenant_id = :tid ORDER BY created_at DESC");
        $this->db->bind(':tid', $tenantId);
        return $this->db->resultSet();
    }

    public function getAllInvoices() {
        $this->db->query("
            SELECT i.*, t.name as tenant_name 
            FROM saas_invoices i
            JOIN saas_tenants t ON i.tenant_id = t.id
            ORDER BY i.created_at DESC
        ");
        return $this->db->resultSet();
    }

    public function exists($tenantId, $month) {
        $this->db->query("SELECT id FROM saas_invoices WHERE tenant_id = :tid AND billing_month = :month");
        $this->db->bind(':tid', $tenantId);
        $this->db->bind(':month', $month);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("INSERT INTO saas_invoices (tenant_id, invoice_number, amount, currency, exchange_rate, source, billing_month, due_date, status, email_status) 
                         VALUES (:tid, :num, :amt, :curr, :rate, :src, :month, :due, :status, 'Pending')");
        $this->db->bind(':tid', $data['tenant_id']);
        $this->db->bind(':num', $data['invoice_number']);
        $this->db->bind(':amt', $data['amount']);
        $this->db->bind(':curr', $data['currency'] ?? 'USD');
        $this->db->bind(':rate', $data['exchange_rate'] ?? 1.0);
        $this->db->bind(':src', $data['source'] ?? 'MARKET');
        $this->db->bind(':month', $data['billing_month']);
        $this->db->bind(':due', $data['due_date']);
        $this->db->bind(':status', $data['status']);
        
        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }
    public function delete($id) {
        $this->db->query("DELETE FROM saas_invoices WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getPayments($invoiceId) {
        $this->db->query("SELECT * FROM saas_payments WHERE invoice_id = :iid ORDER BY created_at DESC");
        $this->db->bind(':iid', $invoiceId);
        return $this->db->resultSet();
    }

    public function getAllPayments() {
        $this->db->query("
            SELECT p.*, i.invoice_number, i.currency, t.name as tenant_name 
            FROM saas_payments p
            JOIN saas_invoices i ON p.invoice_id = i.id
            JOIN saas_tenants t ON i.tenant_id = t.id
            ORDER BY p.created_at DESC
        ");
        return $this->db->resultSet();
    }

    public function logEmail($invoiceId, $type, $recipient, $cc, $status, $error = null, $subject = null, $body = null) {
        $this->db->query("INSERT INTO saas_email_logs (invoice_id, email_type, subject, body, recipient, cc_recipient, status, error_message) 
                         VALUES (:id, :type, :sub, :body, :to, :cc, :status, :err)");
        $this->db->bind(':id', $invoiceId);
        $this->db->bind(':type', $type);
        $this->db->bind(':sub', $subject);
        $this->db->bind(':body', $body);
        $this->db->bind(':to', $recipient);
        $this->db->bind(':cc', $cc);
        $this->db->bind(':status', $status);
        $this->db->bind(':err', $error);
        return $this->db->execute();
    }

    public function getEmailLogs() {
        $this->db->query("
            SELECT 
                l.*, 
                COALESCE(i.invoice_number, 'GENERIC') as invoice_number,
                (
                    SELECT name 
                    FROM saas_tenants 
                    WHERE id = i.tenant_id 
                       OR (l.invoice_id IS NULL AND admin_email COLLATE utf8mb4_unicode_ci = l.recipient COLLATE utf8mb4_unicode_ci)
                    LIMIT 1
                ) as tenant_name
            FROM saas_email_logs l
            LEFT JOIN saas_invoices i ON l.invoice_id = i.id
            ORDER BY l.created_at DESC
        ");
        return $this->db->resultSet();
    }
}
