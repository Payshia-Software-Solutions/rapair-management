<?php
/**
 * DebitNoteHelper - supplier debit notes.
 *
 * A debit note lowers what we owe a supplier without goods going back: price charged above the
 * agreed rate, short supply, damaged goods the supplier agreed to credit, a rebate, a billing
 * mistake. (Goods going back go through Purchase Returns, which also move stock.)
 *
 * Tables (created on first use, see ensure()):
 *   supplier_debit_notes             header: number, supplier, optional GRN, net/tax/total, used amounts, status
 *   supplier_debit_note_items        lines: description, amount (net, before tax)
 *   supplier_debit_note_allocations  what the note settled: applied to a GRN, or money received back
 *
 * Money:
 *   Issue      Dr Payable (supplier)  Cr Purchase Returns & Allowances (net)  Cr Input tax (tax)
 *   Apply      no journal (payable already reduced); lowers that GRN's outstanding balance
 *              (Supplier::getPayableSummary subtracts these allocations)
 *   Refund     Dr Cash/Bank  Cr Payable   (supplier pays the credit back as money)
 *   Cancel     only while nothing is used: the issue journal is reversed
 *
 * Status: Open (credit left) / Used / Cancelled.
 */
require_once __DIR__ . '/AccountingHelper.php';
require_once __DIR__ . '/DocumentSequenceHelper.php';

class DebitNoteHelper {
    const REASONS = ['Price difference', 'Short supply', 'Damaged goods', 'Rebate or discount', 'Billing error', 'Other'];
    private static $ready = false;

    public static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        try {
            $db->query("SELECT 1 FROM supplier_debit_note_allocations LIMIT 1");
            $db->execute();
            return;
        } catch (PDOException $e) { /* create below */ }

        $sql = [
            "CREATE TABLE IF NOT EXISTS supplier_debit_notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                dn_no VARCHAR(40) NOT NULL UNIQUE,
                supplier_id INT NOT NULL,
                grn_id INT NULL,
                supplier_ref VARCHAR(100) NULL,
                dn_date DATE NOT NULL,
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
                INDEX idx_dn_supplier (supplier_id),
                INDEX idx_dn_grn (grn_id),
                INDEX idx_dn_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS supplier_debit_note_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                debit_note_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                INDEX idx_dni_dn (debit_note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS supplier_debit_note_allocations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                debit_note_id INT NOT NULL,
                type ENUM('Apply','Refund') NOT NULL,
                grn_id INT NULL,
                amount DECIMAL(12,2) NOT NULL,
                payment_method VARCHAR(50) NULL,
                reference_no VARCHAR(100) NULL,
                alloc_date DATE NOT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_dna_dn (debit_note_id),
                INDEX idx_dna_grn (grn_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "INSERT IGNORE INTO permissions (perm_key, description) VALUES
                ('debit_notes.read', 'View supplier debit notes'),
                ('debit_notes.write', 'Issue, apply, record refunds and cancel supplier debit notes')",
        ];
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('DebitNote schema: ' . $e->getMessage()); }
        }
    }

    public static function remaining($dn) {
        return round((float)$dn->total - (float)$dn->applied_amount - (float)$dn->refunded_amount, 2);
    }

    private static function lockNote(Database $db, $id) {
        $db->query("SELECT * FROM supplier_debit_notes WHERE id = :id FOR UPDATE");
        $db->bind(':id', (int)$id);
        return $db->single();
    }

    private static function refreshStatus(Database $db, $id) {
        $db->query("UPDATE supplier_debit_notes
                    SET status = CASE WHEN status = 'Cancelled' THEN 'Cancelled'
                                      WHEN total - applied_amount - refunded_amount <= 0.004 THEN 'Used'
                                      ELSE 'Open' END
                    WHERE id = :id");
        $db->bind(':id', (int)$id);
        $db->execute();
    }

    /** What is still owed on a GRN: total less payments, returns and debit notes applied. */
    public static function grnOutstanding(Database $db, $grnId) {
        $db->query("SELECT g.id, g.supplier_id, g.grn_number, g.total_amount,
                        COALESCE((SELECT SUM(amount) FROM acc_supplier_payment_allocations WHERE grn_id = g.id), 0)
                      + COALESCE((SELECT SUM(total_amount) FROM acc_purchase_returns WHERE grn_id = g.id), 0)
                      + COALESCE((SELECT SUM(amount) FROM supplier_debit_note_allocations WHERE grn_id = g.id AND type = 'Apply'), 0) AS settled
                    FROM goods_receive_notes g WHERE g.id = :id");
        $db->bind(':id', (int)$grnId);
        $g = $db->single();
        if (!$g) return null;
        $g->outstanding = round((float)$g->total_amount - (float)$g->settled, 2);
        return $g;
    }

    /**
     * Issue a debit note.
     * $data: supplier_id, grn_id?, supplier_ref?, dn_date?, reason, notes?, location_id?, tax_amount?,
     *        items: [{description, amount}], apply_to_grn? (bool)
     */
    public static function create(Database $db, array $data, $userId) {
        $supplierId = (int)($data['supplier_id'] ?? 0);
        $grnId = !empty($data['grn_id']) ? (int)$data['grn_id'] : null;
        $reason = trim((string)($data['reason'] ?? ''));
        if (!in_array($reason, self::REASONS, true)) throw new Exception('Choose a reason for the debit note.');

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

        $grn = null;
        if ($grnId) {
            $grn = self::grnOutstanding($db, $grnId);
            if (!$grn) throw new Exception('GRN not found.');
            if (!$supplierId) $supplierId = (int)$grn->supplier_id;
            if ((int)$grn->supplier_id !== $supplierId) throw new Exception('The GRN belongs to another supplier.');
            $db->query("SELECT COALESCE(SUM(total), 0) AS t FROM supplier_debit_notes WHERE grn_id = :id AND status <> 'Cancelled'");
            $db->bind(':id', $grnId);
            $already = (float)$db->single()->t;
            if ($already + $total > (float)$grn->total_amount + 0.004) {
                $left = max(0, (float)$grn->total_amount - $already);
                throw new Exception('Debit is more than the GRN total. At most ' . number_format($left, 2) . ' can still be claimed on this GRN.');
            }
        }
        if (!$supplierId) throw new Exception('Choose a supplier.');

        $apAcc = AccountingHelper::getMappedId('grn_ap');
        $retAcc = AccountingHelper::getMappedId('purchase_return');
        $taxAcc = AccountingHelper::getMappedId('purchase_tax');
        if (!$apAcc || !$retAcc || ($tax > 0 && !$taxAcc)) {
            throw new Exception('Accounting is not set up for debit notes. Map "Accounts Payable", "Purchase Return" and "Input Tax" in Accounting settings.');
        }

        $locationId = !empty($data['location_id']) ? (int)$data['location_id'] : 1;
        $date = !empty($data['dn_date']) ? date('Y-m-d', strtotime($data['dn_date'])) : date('Y-m-d');
        $dnNo = DocumentSequenceHelper::getNext('DN', $locationId);

        $db->beginTransaction();
        try {
            $db->query("INSERT INTO supplier_debit_notes (dn_no, supplier_id, grn_id, supplier_ref, dn_date, reason, notes, subtotal, tax_amount, total, location_id, created_by)
                        VALUES (:no, :s, :g, :ref, :d, :r, :n, :sub, :t, :tot, :l, :u)");
            $db->bind(':no', $dnNo);
            $db->bind(':s', $supplierId);
            $db->bind(':g', $grnId);
            $db->bind(':ref', trim((string)($data['supplier_ref'] ?? '')) ?: null);
            $db->bind(':d', $date);
            $db->bind(':r', $reason);
            $db->bind(':n', trim((string)($data['notes'] ?? '')) ?: null);
            $db->bind(':sub', $subtotal);
            $db->bind(':t', $tax);
            $db->bind(':tot', $total);
            $db->bind(':l', $locationId);
            $db->bind(':u', $userId ?: null);
            $db->execute();
            $id = (int)$db->lastInsertId();

            foreach ($lines as $l) {
                $db->query("INSERT INTO supplier_debit_note_items (debit_note_id, description, amount) VALUES (:id, :d, :a)");
                $db->bind(':id', $id);
                $db->bind(':d', $l['description']);
                $db->bind(':a', $l['amount']);
                $db->execute();
            }

            $items = [['account_id' => $apAcc, 'debit' => $total, 'credit' => 0, 'partner_type' => 'Supplier', 'partner_id' => $supplierId, 'notes' => "Debit note {$dnNo}"]];
            $items[] = ['account_id' => $retAcc, 'debit' => 0, 'credit' => $subtotal, 'notes' => "Debit note {$dnNo}: {$reason}"];
            if ($tax > 0) $items[] = ['account_id' => $taxAcc, 'debit' => 0, 'credit' => $tax, 'notes' => "Input tax reversed, debit note {$dnNo}"];
            $ok = (new Journal())->post([
                'entry_date' => $date,
                'description' => "Debit Note {$dnNo}" . ($grn ? " for {$grn->grn_number}" : ''),
                'ref_type' => 'DebitNote', 'ref_id' => $id,
                'location_id' => $locationId,
                'userId' => $userId, 'items' => $items,
            ]);
            if (!$ok) throw new Exception('Could not post the debit note to the ledger.');

            if ($grn && !empty($data['apply_to_grn'])) {
                $amt = min(max(0, $grn->outstanding), $total);
                if ($amt > 0) self::applyLocked($db, $id, $grnId, $amt, $userId);
            }

            $db->commit();
            return ['id' => $id, 'dn_no' => $dnNo];
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    private static function applyLocked(Database $db, $dnId, $grnId, $amount, $userId) {
        $db->query("INSERT INTO supplier_debit_note_allocations (debit_note_id, type, grn_id, amount, alloc_date, created_by)
                    VALUES (:d, 'Apply', :g, :a, CURDATE(), :u)");
        $db->bind(':d', (int)$dnId);
        $db->bind(':g', (int)$grnId);
        $db->bind(':a', $amount);
        $db->bind(':u', $userId ?: null);
        $db->execute();
        $db->query("UPDATE supplier_debit_notes SET applied_amount = applied_amount + :a WHERE id = :id");
        $db->bind(':a', $amount);
        $db->bind(':id', (int)$dnId);
        $db->execute();
        self::refreshStatus($db, $dnId);
    }

    /** Use open debit to settle (part of) a GRN of the same supplier. */
    public static function apply(Database $db, $id, $grnId, $amount, $userId) {
        $amount = round((float)$amount, 2);
        if ($amount <= 0) throw new Exception('Enter an amount more than zero.');
        $db->beginTransaction();
        try {
            $dn = self::lockNote($db, $id);
            if (!$dn) throw new Exception('Debit note not found.');
            if ($dn->status !== 'Open') throw new Exception("Debit note {$dn->dn_no} has nothing left.");
            $left = self::remaining($dn);
            if ($amount > $left + 0.004) throw new Exception('Only ' . number_format($left, 2) . ' is left on this note.');
            $g = self::grnOutstanding($db, $grnId);
            if (!$g) throw new Exception('GRN not found.');
            if ((int)$g->supplier_id !== (int)$dn->supplier_id) throw new Exception('The GRN belongs to another supplier.');
            if ($g->outstanding <= 0) throw new Exception('That GRN is already settled.');
            if ($amount > $g->outstanding + 0.004) throw new Exception('The GRN only has ' . number_format($g->outstanding, 2) . ' left to pay.');
            self::applyLocked($db, (int)$dn->id, (int)$g->id, $amount, $userId);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /** The supplier paid the credit back as money. */
    public static function refund(Database $db, $id, $amount, $method, $reference, $userId) {
        $amount = round((float)$amount, 2);
        $method = trim((string)$method);
        if ($amount <= 0) throw new Exception('Enter an amount more than zero.');
        if (!in_array($method, ['Cash', 'Card', 'Bank Transfer', 'Cheque'], true)) throw new Exception('Choose how the money came back.');
        $apAcc = AccountingHelper::getMappedId('grn_ap');
        $funds = AccountingHelper::fundsAccount($method);
        if (!$apAcc || !$funds) throw new Exception('Accounting is not set up for this.');

        $db->beginTransaction();
        try {
            $dn = self::lockNote($db, $id);
            if (!$dn) throw new Exception('Debit note not found.');
            if ($dn->status !== 'Open') throw new Exception("Debit note {$dn->dn_no} has nothing left.");
            $left = self::remaining($dn);
            if ($amount > $left + 0.004) throw new Exception('Only ' . number_format($left, 2) . ' is left on this note.');

            $db->query("INSERT INTO supplier_debit_note_allocations (debit_note_id, type, amount, payment_method, reference_no, alloc_date, created_by)
                        VALUES (:d, 'Refund', :a, :m, :r, CURDATE(), :u)");
            $db->bind(':d', (int)$dn->id);
            $db->bind(':a', $amount);
            $db->bind(':m', $method);
            $db->bind(':r', trim((string)$reference) ?: null);
            $db->bind(':u', $userId ?: null);
            $db->execute();
            $allocId = (int)$db->lastInsertId();
            $db->query("UPDATE supplier_debit_notes SET refunded_amount = refunded_amount + :a WHERE id = :id");
            $db->bind(':a', $amount);
            $db->bind(':id', (int)$dn->id);
            $db->execute();
            self::refreshStatus($db, (int)$dn->id);

            $ok = (new Journal())->post([
                'entry_date' => date('Y-m-d'),
                'description' => "Money received for debit note {$dn->dn_no}",
                'ref_type' => 'DebitNoteRefund', 'ref_id' => $allocId,
                'location_id' => $dn->location_id ? (int)$dn->location_id : null,
                'userId' => $userId,
                'items' => [
                    ['account_id' => $funds, 'debit' => $amount, 'credit' => 0, 'notes' => "Supplier refund {$dn->dn_no} by {$method}"],
                    ['account_id' => $apAcc, 'debit' => 0, 'credit' => $amount, 'partner_type' => 'Supplier', 'partner_id' => (int)$dn->supplier_id, 'notes' => "Debit note {$dn->dn_no} refunded"],
                ],
            ]);
            if (!$ok) throw new Exception('Could not post the refund to the ledger.');
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function cancel(Database $db, $id, $reason, $userId) {
        $reason = trim((string)$reason);
        if ($reason === '') throw new Exception('Give a reason for cancelling.');
        $db->beginTransaction();
        try {
            $dn = self::lockNote($db, $id);
            if (!$dn) throw new Exception('Debit note not found.');
            if ($dn->status === 'Cancelled') throw new Exception('Already cancelled.');
            if ((float)$dn->applied_amount > 0 || (float)$dn->refunded_amount > 0) {
                throw new Exception('This debit note has already been used. It cannot be cancelled.');
            }
            $db->query("UPDATE supplier_debit_notes SET status = 'Cancelled', cancelled_at = NOW(), cancelled_by = :u, cancel_reason = :r WHERE id = :id");
            $db->bind(':u', $userId ?: null);
            $db->bind(':r', mb_substr($reason, 0, 255));
            $db->bind(':id', (int)$dn->id);
            $db->execute();
            (new Journal())->reverseAllForRef('DebitNote', (int)$dn->id, $userId);
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function listAll(Database $db, array $f = []) {
        $where = ['1=1'];
        $binds = [];
        if (!empty($f['status'])) { $where[] = 'dn.status = :st'; $binds[':st'] = $f['status']; }
        if (!empty($f['supplier_id'])) { $where[] = 'dn.supplier_id = :s'; $binds[':s'] = (int)$f['supplier_id']; }
        if (!empty($f['q'])) {
            $where[] = '(dn.dn_no LIKE :q OR s.name LIKE :q OR g.grn_number LIKE :q OR dn.supplier_ref LIKE :q)';
            $binds[':q'] = '%' . $f['q'] . '%';
        }
        $db->query("SELECT dn.*, s.name AS supplier_name, g.grn_number,
                           (dn.total - dn.applied_amount - dn.refunded_amount) AS remaining
                    FROM supplier_debit_notes dn
                    LEFT JOIN suppliers s ON s.id = dn.supplier_id
                    LEFT JOIN goods_receive_notes g ON g.id = dn.grn_id
                    WHERE " . implode(' AND ', $where) . "
                    ORDER BY dn.id DESC LIMIT 500");
        foreach ($binds as $k => $v) $db->bind($k, $v);
        return $db->resultSet();
    }

    public static function detail(Database $db, $id) {
        $db->query("SELECT dn.*, s.name AS supplier_name, g.grn_number,
                           (dn.total - dn.applied_amount - dn.refunded_amount) AS remaining
                    FROM supplier_debit_notes dn
                    LEFT JOIN suppliers s ON s.id = dn.supplier_id
                    LEFT JOIN goods_receive_notes g ON g.id = dn.grn_id
                    WHERE dn.id = :id");
        $db->bind(':id', (int)$id);
        $dn = $db->single();
        if (!$dn) return null;
        $db->query("SELECT description, amount FROM supplier_debit_note_items WHERE debit_note_id = :id ORDER BY id");
        $db->bind(':id', (int)$id);
        $dn->items = $db->resultSet();
        $db->query("SELECT a.*, g.grn_number FROM supplier_debit_note_allocations a LEFT JOIN goods_receive_notes g ON g.id = a.grn_id
                    WHERE a.debit_note_id = :id ORDER BY a.id");
        $db->bind(':id', (int)$id);
        $dn->allocations = $db->resultSet();
        return $dn;
    }

    /** GRNs of a supplier with what is still owed. $all: every GRN (to attach a note to), else only unsettled. */
    public static function supplierGrns(Database $db, $supplierId, $all = false) {
        $db->query("SELECT g.id, g.grn_number, g.received_at, g.total_amount,
                        g.total_amount
                        - COALESCE((SELECT SUM(amount) FROM acc_supplier_payment_allocations WHERE grn_id = g.id), 0)
                        - COALESCE((SELECT SUM(total_amount) FROM acc_purchase_returns WHERE grn_id = g.id), 0)
                        - COALESCE((SELECT SUM(amount) FROM supplier_debit_note_allocations WHERE grn_id = g.id AND type = 'Apply'), 0) AS outstanding
                    FROM goods_receive_notes g
                    WHERE g.supplier_id = :s
                    " . ($all ? "" : "HAVING outstanding > 0.004") . "
                    ORDER BY g.received_at " . ($all ? "DESC" : "ASC") . " LIMIT 200");
        $db->bind(':s', (int)$supplierId);
        return $db->resultSet();
    }
}
