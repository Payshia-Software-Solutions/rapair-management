<?php
/**
 * CreditNoteHelper - customer credit notes.
 *
 * A credit note lowers what a customer owes without goods coming back: a price correction,
 * an agreed discount after the sale, goodwill, a billing mistake. (Goods coming back go through
 * Sales Returns, which also move stock.)
 *
 * Tables (created on first use, see ensure()):
 *   credit_notes             header: number, customer, optional invoice, net/tax/total, used amounts, status
 *   credit_note_items        lines: description, amount (net, before tax)
 *   credit_note_allocations  what the note paid off: applied to an invoice, or refunded to the customer
 *
 * Money:
 *   Issue      Dr Sales Returns & Allowances (net)  Dr Output tax (tax)  Cr Receivable (customer)
 *   Apply      no journal (receivable already credited); an invoice_payments row "Credit Note"
 *              reduces that invoice's balance
 *   Refund     Dr Receivable  Cr Cash/Card/Bank   (money given back for unused credit)
 *   Cancel     only while nothing is used: the issue journal is reversed
 *
 * Status: Open (credit left) / Used (fully applied or refunded) / Cancelled.
 */
require_once __DIR__ . '/AccountingHelper.php';
require_once __DIR__ . '/DocumentSequenceHelper.php';

class CreditNoteHelper {
    const METHOD = 'Credit Note';
    const REASONS = ['Price correction', 'Discount after sale', 'Billing error', 'Goodwill', 'Service issue', 'Other'];
    private static $ready = false;

    public static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        try {
            $db->query("SELECT 1 FROM credit_note_allocations LIMIT 1");
            $db->execute();
            return;
        } catch (PDOException $e) { /* create below */ }

        $sql = [
            "CREATE TABLE IF NOT EXISTS credit_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                cn_no VARCHAR(40) NOT NULL UNIQUE,
                customer_id INT NOT NULL,
                invoice_id INT NULL,
                cn_date DATE NOT NULL,
                reason VARCHAR(60) NOT NULL,
                notes TEXT NULL,
                subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
                tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                total DECIMAL(12,2) NOT NULL DEFAULT 0,
                applied_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
                status ENUM('Open','Used','Cancelled') NOT NULL DEFAULT 'Open',
                location_id INT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                cancelled_at DATETIME NULL,
                cancelled_by INT NULL,
                cancel_reason VARCHAR(255) NULL,
                INDEX idx_cn_customer (customer_id),
                INDEX idx_cn_invoice (invoice_id),
                INDEX idx_cn_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS credit_note_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                credit_note_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                INDEX idx_cni_cn (credit_note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS credit_note_allocations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                credit_note_id INT NOT NULL,
                type ENUM('Apply','Refund') NOT NULL,
                invoice_id INT NULL,
                invoice_payment_id INT NULL,
                amount DECIMAL(12,2) NOT NULL,
                payment_method VARCHAR(50) NULL,
                reference_no VARCHAR(100) NULL,
                alloc_date DATE NOT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_cna_cn (credit_note_id),
                INDEX idx_cna_invoice (invoice_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "INSERT IGNORE INTO permissions (perm_key, description) VALUES
                ('credit_notes.read', 'View customer credit notes'),
                ('credit_notes.write', 'Issue, apply, refund and cancel credit notes')",
        ];
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('CreditNote schema: ' . $e->getMessage()); }
        }
    }

    public static function remaining($cn) {
        return round((float)$cn->total - (float)$cn->applied_amount - (float)$cn->refunded_amount, 2);
    }

    private static function lockNote(Database $db, $id) {
        $db->query("SELECT * FROM credit_notes WHERE id = :id FOR UPDATE");
        $db->bind(':id', (int)$id);
        return $db->single();
    }

    private static function refreshStatus(Database $db, $id) {
        $db->query("UPDATE credit_notes
                    SET status = CASE WHEN status = 'Cancelled' THEN 'Cancelled'
                                      WHEN total - applied_amount - refunded_amount <= 0.004 THEN 'Used'
                                      ELSE 'Open' END
                    WHERE id = :id");
        $db->bind(':id', (int)$id);
        $db->execute();
    }

    /** Invoice balance from its payments, the same way Invoice::updatePaidStatus does it. */
    private static function refreshInvoice(Database $db, $invoiceId) {
        $db->query("SELECT COALESCE(SUM(amount), 0) AS paid FROM invoice_payments WHERE invoice_id = :id");
        $db->bind(':id', (int)$invoiceId);
        $paid = (float)$db->single()->paid;
        $db->query("SELECT grand_total, status FROM invoices WHERE id = :id");
        $db->bind(':id', (int)$invoiceId);
        $inv = $db->single();
        if (!$inv || in_array(strtolower((string)$inv->status), ['cancelled'], true)) return;
        $status = $paid >= (float)$inv->grand_total - 0.004 ? 'Paid' : ($paid > 0 ? 'Partial' : 'Unpaid');
        $db->query("UPDATE invoices SET paid_amount = :p, status = :s WHERE id = :id");
        $db->bind(':p', $paid);
        $db->bind(':s', $status);
        $db->bind(':id', (int)$invoiceId);
        $db->execute();
    }

    /**
     * Issue a credit note.
     * $data: customer_id, invoice_id?, cn_date?, reason, notes?, location_id?, tax_amount?,
     *        items: [{description, amount}], apply_to_invoice? (bool, applies at once to invoice_id)
     */
    public static function create(Database $db, array $data, $userId) {
        $customerId = (int)($data['customer_id'] ?? 0);
        $invoiceId = !empty($data['invoice_id']) ? (int)$data['invoice_id'] : null;
        $reason = trim((string)($data['reason'] ?? ''));
        if (!in_array($reason, self::REASONS, true)) throw new Exception('Choose a reason for the credit note.');

        $lines = [];
        foreach (($data['items'] ?? []) as $it) {
            $desc = trim((string)($it['description'] ?? ''));
            $amt = round((float)($it['amount'] ?? 0), 2);
            if ($desc === '' && $amt == 0) continue;
            if ($desc === '') throw new Exception('Every line needs a description.');
            if ($amt <= 0) throw new Exception('Line amounts must be more than zero.');
            $lines[] = ['description' => mb_substr($desc, 0, 255), 'amount' => $amt];
        }
        if (!$lines) throw new Exception('Add at least one line.');
        $subtotal = round(array_sum(array_column($lines, 'amount')), 2);
        $tax = round(max(0, (float)($data['tax_amount'] ?? 0)), 2);
        $total = round($subtotal + $tax, 2);

        $inv = null;
        if ($invoiceId) {
            $db->query("SELECT id, invoice_no, customer_id, grand_total, paid_amount, status, location_id FROM invoices WHERE id = :id");
            $db->bind(':id', $invoiceId);
            $inv = $db->single();
            if (!$inv) throw new Exception('Invoice not found.');
            if (strtolower((string)$inv->status) === 'cancelled') throw new Exception('That invoice is cancelled.');
            if (!$customerId) $customerId = (int)$inv->customer_id;
            if ((int)$inv->customer_id !== $customerId) throw new Exception('The invoice belongs to another customer.');
            // Never credit more than was billed on this invoice, counting earlier notes
            $db->query("SELECT COALESCE(SUM(total), 0) AS t FROM credit_notes WHERE invoice_id = :id AND status <> 'Cancelled'");
            $db->bind(':id', $invoiceId);
            $already = (float)$db->single()->t;
            if ($already + $total > (float)$inv->grand_total + 0.004) {
                $left = max(0, (float)$inv->grand_total - $already);
                throw new Exception('Credit is more than the invoice total. At most ' . number_format($left, 2) . ' can still be credited on this invoice.');
            }
        }
        if (!$customerId) throw new Exception('Choose a customer.');

        $locationId = !empty($data['location_id']) ? (int)$data['location_id'] : ($inv ? (int)$inv->location_id : 1);
        $date = !empty($data['cn_date']) ? date('Y-m-d', strtotime($data['cn_date'])) : date('Y-m-d');

        $retAcc = AccountingHelper::getMappedId('sales_return');
        $arAcc = AccountingHelper::getMappedId('invoice_ar');
        $taxAcc = AccountingHelper::getMappedId('invoice_tax');
        if (!$retAcc || !$arAcc || ($tax > 0 && !$taxAcc)) {
            throw new Exception('Accounting is not set up for credit notes. Map "Sales Return", "Accounts Receivable" and "Output Tax" in Accounting settings.');
        }

        // Number first: the sequence helper runs its own short transaction
        $cnNo = DocumentSequenceHelper::getNext('CN', $locationId);

        $db->beginTransaction();
        try {
            $db->query("INSERT INTO credit_notes (cn_no, customer_id, invoice_id, cn_date, reason, notes, subtotal, tax_amount, total, location_id, created_by)
                        VALUES (:no, :c, :i, :d, :r, :n, :s, :t, :tot, :l, :u)");
            $db->bind(':no', $cnNo);
            $db->bind(':c', $customerId);
            $db->bind(':i', $invoiceId);
            $db->bind(':d', $date);
            $db->bind(':r', $reason);
            $db->bind(':n', trim((string)($data['notes'] ?? '')) ?: null);
            $db->bind(':s', $subtotal);
            $db->bind(':t', $tax);
            $db->bind(':tot', $total);
            $db->bind(':l', $locationId);
            $db->bind(':u', $userId ?: null);
            $db->execute();
            $id = (int)$db->lastInsertId();

            foreach ($lines as $l) {
                $db->query("INSERT INTO credit_note_items (credit_note_id, description, amount) VALUES (:id, :d, :a)");
                $db->bind(':id', $id);
                $db->bind(':d', $l['description']);
                $db->bind(':a', $l['amount']);
                $db->execute();
            }

            $items = [['account_id' => $retAcc, 'debit' => $subtotal, 'credit' => 0, 'notes' => "Credit note {$cnNo}: {$reason}"]];
            if ($tax > 0) $items[] = ['account_id' => $taxAcc, 'debit' => $tax, 'credit' => 0, 'notes' => "Output tax reversed, credit note {$cnNo}"];
            $items[] = ['account_id' => $arAcc, 'debit' => 0, 'credit' => $total, 'partner_type' => 'Customer', 'partner_id' => $customerId, 'notes' => "Credit note {$cnNo}"];
            $ok = (new Journal())->post([
                'entry_date' => $date,
                'description' => "Credit Note {$cnNo}" . ($inv ? " for {$inv->invoice_no}" : ''),
                'ref_type' => 'CreditNote', 'ref_id' => $id,
                'location_id' => $locationId,
                'userId' => $userId, 'items' => $items,
            ]);
            if (!$ok) throw new Exception('Could not post the credit note to the ledger.');

            if ($inv && !empty($data['apply_to_invoice'])) {
                $due = round((float)$inv->grand_total - (float)$inv->paid_amount, 2);
                $amt = min($due, $total);
                if ($amt > 0) self::applyLocked($db, $id, $cnNo, $total, 0, (int)$inv->id, $amt, $userId);
            }

            $db->commit();
            return ['id' => $id, 'cn_no' => $cnNo];
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    private static function applyLocked(Database $db, $cnId, $cnNo, $total, $used, $invoiceId, $amount, $userId) {
        $db->query("INSERT INTO invoice_payments (invoice_id, amount, payment_date, payment_method, reference_no, notes, created_by)
                    VALUES (:i, :a, CURDATE(), :m, :r, :n, :u)");
        $db->bind(':i', (int)$invoiceId);
        $db->bind(':a', $amount);
        $db->bind(':m', self::METHOD);
        $db->bind(':r', $cnNo);
        $db->bind(':n', "Credit note {$cnNo} applied");
        $db->bind(':u', $userId ?: null);
        $db->execute();
        $payId = (int)$db->lastInsertId();

        $db->query("INSERT INTO credit_note_allocations (credit_note_id, type, invoice_id, invoice_payment_id, amount, alloc_date, created_by)
                    VALUES (:c, 'Apply', :i, :p, :a, CURDATE(), :u)");
        $db->bind(':c', (int)$cnId);
        $db->bind(':i', (int)$invoiceId);
        $db->bind(':p', $payId);
        $db->bind(':a', $amount);
        $db->bind(':u', $userId ?: null);
        $db->execute();

        $db->query("UPDATE credit_notes SET applied_amount = applied_amount + :a WHERE id = :id");
        $db->bind(':a', $amount);
        $db->bind(':id', (int)$cnId);
        $db->execute();
        self::refreshStatus($db, $cnId);
        self::refreshInvoice($db, $invoiceId);
    }

    /** Use open credit to pay off (part of) an unpaid invoice of the same customer. */
    public static function apply(Database $db, $id, $invoiceId, $amount, $userId) {
        $amount = round((float)$amount, 2);
        if ($amount <= 0) throw new Exception('Enter an amount more than zero.');
        $db->beginTransaction();
        try {
            $cn = self::lockNote($db, $id);
            if (!$cn) throw new Exception('Credit note not found.');
            if ($cn->status !== 'Open') throw new Exception("Credit note {$cn->cn_no} has no credit left.");
            $left = self::remaining($cn);
            if ($amount > $left + 0.004) throw new Exception('Only ' . number_format($left, 2) . ' credit is left on this note.');

            $db->query("SELECT id, customer_id, grand_total, paid_amount, status FROM invoices WHERE id = :id FOR UPDATE");
            $db->bind(':id', (int)$invoiceId);
            $inv = $db->single();
            if (!$inv) throw new Exception('Invoice not found.');
            if ((int)$inv->customer_id !== (int)$cn->customer_id) throw new Exception('The invoice belongs to another customer.');
            if (strtolower((string)$inv->status) === 'cancelled') throw new Exception('That invoice is cancelled.');
            $due = round((float)$inv->grand_total - (float)$inv->paid_amount, 2);
            if ($due <= 0) throw new Exception('That invoice is already paid.');
            if ($amount > $due + 0.004) throw new Exception('The invoice only has ' . number_format($due, 2) . ' left to pay.');

            self::applyLocked($db, (int)$cn->id, $cn->cn_no, (float)$cn->total, 0, (int)$inv->id, $amount, $userId);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /** Give unused credit back as money. */
    public static function refund(Database $db, $id, $amount, $method, $reference, $userId) {
        $amount = round((float)$amount, 2);
        $method = trim((string)$method);
        if ($amount <= 0) throw new Exception('Enter an amount more than zero.');
        if (!in_array($method, ['Cash', 'Card', 'Bank Transfer', 'Cheque'], true)) throw new Exception('Choose how the money is paid back.');
        $arAcc = AccountingHelper::getMappedId('invoice_ar');
        $funds = AccountingHelper::fundsAccount($method);
        if (!$arAcc || !$funds) throw new Exception('Accounting is not set up for refunds.');

        $db->beginTransaction();
        try {
            $cn = self::lockNote($db, $id);
            if (!$cn) throw new Exception('Credit note not found.');
            if ($cn->status !== 'Open') throw new Exception("Credit note {$cn->cn_no} has no credit left.");
            $left = self::remaining($cn);
            if ($amount > $left + 0.004) throw new Exception('Only ' . number_format($left, 2) . ' credit is left on this note.');

            $db->query("INSERT INTO credit_note_allocations (credit_note_id, type, amount, payment_method, reference_no, alloc_date, created_by)
                        VALUES (:c, 'Refund', :a, :m, :r, CURDATE(), :u)");
            $db->bind(':c', (int)$cn->id);
            $db->bind(':a', $amount);
            $db->bind(':m', $method);
            $db->bind(':r', trim((string)$reference) ?: null);
            $db->bind(':u', $userId ?: null);
            $db->execute();
            $allocId = (int)$db->lastInsertId();

            $db->query("UPDATE credit_notes SET refunded_amount = refunded_amount + :a WHERE id = :id");
            $db->bind(':a', $amount);
            $db->bind(':id', (int)$cn->id);
            $db->execute();
            self::refreshStatus($db, (int)$cn->id);

            $ok = (new Journal())->post([
                'entry_date' => date('Y-m-d'),
                'description' => "Refund of credit note {$cn->cn_no}",
                'ref_type' => 'CreditNoteRefund', 'ref_id' => $allocId,
                'location_id' => $cn->location_id ? (int)$cn->location_id : null,
                'userId' => $userId,
                'items' => [
                    ['account_id' => $arAcc, 'debit' => $amount, 'credit' => 0, 'partner_type' => 'Customer', 'partner_id' => (int)$cn->customer_id, 'notes' => "Credit note {$cn->cn_no} refunded"],
                    ['account_id' => $funds, 'debit' => 0, 'credit' => $amount, 'notes' => "Refund {$cn->cn_no} by {$method}"],
                ],
            ]);
            if (!$ok) throw new Exception('Could not post the refund to the ledger.');
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /** Cancel a note nobody has used yet; its journal is reversed. */
    public static function cancel(Database $db, $id, $reason, $userId) {
        $reason = trim((string)$reason);
        if ($reason === '') throw new Exception('Give a reason for cancelling.');
        $db->beginTransaction();
        try {
            $cn = self::lockNote($db, $id);
            if (!$cn) throw new Exception('Credit note not found.');
            if ($cn->status === 'Cancelled') throw new Exception('Already cancelled.');
            if ((float)$cn->applied_amount > 0 || (float)$cn->refunded_amount > 0) {
                throw new Exception('This credit note has already been used. It cannot be cancelled.');
            }
            $db->query("UPDATE credit_notes SET status = 'Cancelled', cancelled_at = NOW(), cancelled_by = :u, cancel_reason = :r WHERE id = :id");
            $db->bind(':u', $userId ?: null);
            $db->bind(':r', mb_substr($reason, 0, 255));
            $db->bind(':id', (int)$cn->id);
            $db->execute();
            (new Journal())->reverseAllForRef('CreditNote', (int)$cn->id, $userId);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function listAll(Database $db, array $f = []) {
        $where = ['1=1'];
        $binds = [];
        if (!empty($f['status'])) { $where[] = 'cn.status = :st'; $binds[':st'] = $f['status']; }
        if (!empty($f['customer_id'])) { $where[] = 'cn.customer_id = :c'; $binds[':c'] = (int)$f['customer_id']; }
        if (!empty($f['q'])) {
            $where[] = '(cn.cn_no LIKE :q OR c.name LIKE :q OR i.invoice_no LIKE :q)';
            $binds[':q'] = '%' . $f['q'] . '%';
        }
        $db->query("SELECT cn.*, c.name AS customer_name, i.invoice_no,
                           (cn.total - cn.applied_amount - cn.refunded_amount) AS remaining
                    FROM credit_notes cn
                    LEFT JOIN customers c ON c.id = cn.customer_id
                    LEFT JOIN invoices i ON i.id = cn.invoice_id
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY cn.id DESC LIMIT 500");
        foreach ($binds as $k => $v) $db->bind($k, $v);
        return $db->resultSet();
    }

    public static function detail(Database $db, $id) {
        $db->query("SELECT cn.*, c.name AS customer_name, c.phone AS customer_phone, i.invoice_no,
                           (cn.total - cn.applied_amount - cn.refunded_amount) AS remaining
                    FROM credit_notes cn
                    LEFT JOIN customers c ON c.id = cn.customer_id
                    LEFT JOIN invoices i ON i.id = cn.invoice_id
                    WHERE cn.id = :id");
        $db->bind(':id', (int)$id);
        $cn = $db->single();
        if (!$cn) return null;
        $db->query("SELECT description, amount FROM credit_note_items WHERE credit_note_id = :id ORDER BY id");
        $db->bind(':id', (int)$id);
        $cn->items = $db->resultSet();
        $db->query("SELECT a.*, i.invoice_no FROM credit_note_allocations a LEFT JOIN invoices i ON i.id = a.invoice_id
                    WHERE a.credit_note_id = :id ORDER BY a.id");
        $db->bind(':id', (int)$id);
        $cn->allocations = $db->resultSet();
        return $cn;
    }

    /** Unpaid invoices of a customer, to apply credit against. */
    public static function openInvoices(Database $db, $customerId, $all = false) {
        // $all: every non-cancelled invoice (to attach a note to), newest first; else only unpaid ones
        $db->query("SELECT id, invoice_no, issue_date, grand_total, paid_amount, (grand_total - paid_amount) AS due, status
                    FROM invoices
                    WHERE customer_id = :c AND " . ($all
                        ? "status NOT IN ('Cancelled','CANCELLED') ORDER BY issue_date DESC, id DESC"
                        : "status IN ('Unpaid','Partial') AND grand_total - paid_amount > 0.004 ORDER BY issue_date ASC, id ASC") . " LIMIT 200");
        $db->bind(':c', (int)$customerId);
        return $db->resultSet();
    }
}
