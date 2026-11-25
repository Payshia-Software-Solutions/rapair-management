<?php
/**
 * GiftVoucherHelper - stored-value gift vouchers.
 *
 * Tables (created on first use, see ensure()):
 *   gift_vouchers       one row per voucher: code, initial value, balance, status, expiry
 *   gift_voucher_txns   ledger: Issue / Sale / Redeem / Restore / Void (amount signed, balance after)
 *
 * Money:
 *   Sold at the POS     Dr Cash/Card/Bank        Cr Gift Vouchers Outstanding (liability)
 *   Issued free         Dr Complimentary expense Cr Gift Vouchers Outstanding
 *   Paid a bill with    Dr Gift Vouchers Outstanding  Cr Receivable  (payment method "Gift Voucher",
 *                       posted by the payment receipt like any other method)
 *   Voided with balance the remaining balance is reversed against the account it came from.
 *
 * Vouchers can be part-used: the balance stays until it runs out or the voucher expires.
 * Expiry is checked when a voucher is used; an expired balance stays on the liability until
 * someone voids the voucher.
 */
class GiftVoucherHelper {
    const METHOD = 'Gift Voucher';
    private static $ready = false;

    public static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        try {
            $db->query("SELECT 1 FROM gift_voucher_txns LIMIT 1");
            $db->execute();
            return;
        } catch (PDOException $e) { /* create below */ }

        $sql = [
            "CREATE TABLE IF NOT EXISTS gift_vouchers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(32) NOT NULL UNIQUE,
                initial_value DECIMAL(12,2) NOT NULL,
                balance DECIMAL(12,2) NOT NULL,
                status ENUM('Active','Redeemed','Void') NOT NULL DEFAULT 'Active',
                source ENUM('Sold','Issued') NOT NULL DEFAULT 'Sold',
                customer_id INT NULL,
                recipient_name VARCHAR(150) NULL,
                recipient_phone VARCHAR(40) NULL,
                message VARCHAR(255) NULL,
                expires_at DATE NULL,
                location_id INT NULL,
                payment_method VARCHAR(50) NULL,
                notes VARCHAR(255) NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                voided_at DATETIME NULL,
                voided_by INT NULL,
                void_reason VARCHAR(255) NULL,
                INDEX idx_gv_status (status),
                INDEX idx_gv_customer (customer_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS gift_voucher_txns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                voucher_id INT NOT NULL,
                type ENUM('Issue','Sale','Redeem','Restore','Void') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                balance_after DECIMAL(12,2) NOT NULL,
                invoice_id INT NULL,
                receipt_no VARCHAR(50) NULL,
                notes VARCHAR(255) NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_gvt_voucher (voucher_id),
                INDEX idx_gvt_invoice (invoice_id),
                INDEX idx_gvt_receipt (receipt_no)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "INSERT IGNORE INTO permissions (perm_key, description) VALUES
                ('gift_vouchers.read', 'View gift vouchers'),
                ('gift_vouchers.write', 'Issue and void gift vouchers')",
        ];
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('GiftVoucher schema: ' . $e->getMessage()); }
        }
    }

    public static function normalizeCode($code) {
        return strtoupper(preg_replace('/[^A-Za-z0-9-]/', '', (string)$code));
    }

    /** GV-XXXX-XXXX with no look-alike characters (0/O, 1/I/L). */
    public static function generateCode(Database $db) {
        $chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        for ($try = 0; $try < 20; $try++) {
            $s = '';
            for ($i = 0; $i < 8; $i++) $s .= $chars[random_int(0, strlen($chars) - 1)];
            $code = 'GV-' . substr($s, 0, 4) . '-' . substr($s, 4);
            $db->query("SELECT id FROM gift_vouchers WHERE code = :c");
            $db->bind(':c', $code);
            if (!$db->single()) return $code;
        }
        throw new Exception('Could not generate a voucher code. Try again.');
    }

    public static function byCode(Database $db, $code, $lock = false) {
        $db->query("SELECT * FROM gift_vouchers WHERE code = :c" . ($lock ? " FOR UPDATE" : ""));
        $db->bind(':c', self::normalizeCode($code));
        return $db->single() ?: null;
    }

    public static function isExpired($v) {
        return !empty($v->expires_at) && $v->expires_at < date('Y-m-d');
    }

    /** Status as people see it: Active / Redeemed / Void / Expired. */
    public static function displayStatus($v) {
        if ($v->status === 'Active' && self::isExpired($v)) return 'Expired';
        return $v->status;
    }

    /** POS card: what the voucher can still pay. */
    public static function lookup(Database $db, $code) {
        self::ensure($db);
        $v = self::byCode($db, $code);
        if (!$v) return null;
        $status = self::displayStatus($v);
        return [
            'id' => (int)$v->id,
            'code' => $v->code,
            'balance' => (float)$v->balance,
            'initial_value' => (float)$v->initial_value,
            'status' => $status,
            'expires_at' => $v->expires_at,
            'recipient_name' => $v->recipient_name,
            'usable' => $status === 'Active' && (float)$v->balance > 0,
            'message' => self::refusal($v),
        ];
    }

    private static function refusal($v, $amount = 0) {
        if (!$v) return 'Gift voucher not found.';
        if ($v->status === 'Void') return "Gift voucher {$v->code} was voided.";
        if ($v->status === 'Redeemed' || (float)$v->balance <= 0) return "Gift voucher {$v->code} has no balance left.";
        if (self::isExpired($v)) return "Gift voucher {$v->code} expired on {$v->expires_at}.";
        if ($amount > (float)$v->balance + 0.004) return "Gift voucher {$v->code} has only " . number_format((float)$v->balance, 2) . " left.";
        return null;
    }

    /** Null when the voucher can pay this amount, otherwise why not. */
    public static function checkRedeemable(Database $db, $code, $amount) {
        if (self::normalizeCode($code) === '') return 'Enter the gift voucher code.';
        if ($amount <= 0) return 'Gift voucher amount must be more than zero.';
        return self::refusal(self::byCode($db, $code), $amount);
    }

    /** Takes the amount off the voucher. Call inside the invoice transaction; throws on failure. */
    public static function redeem(Database $db, $code, $amount, $invoiceId, $receiptNo, $userId) {
        $v = self::byCode($db, $code, true);
        $err = self::refusal($v, $amount);
        if ($err) throw new Exception($err);
        $after = round((float)$v->balance - $amount, 2);
        $db->query("UPDATE gift_vouchers SET balance = :b, status = :s WHERE id = :id");
        $db->bind(':b', $after);
        $db->bind(':s', $after <= 0.004 ? 'Redeemed' : 'Active');
        $db->bind(':id', (int)$v->id);
        $db->execute();
        self::txn($db, (int)$v->id, 'Redeem', -$amount, $after, $invoiceId, $receiptNo, null, $userId);
        return $after;
    }

    /** A cancelled gift-voucher receipt puts its amount back on the voucher (once). */
    public static function restoreForReceipt(Database $db, $receiptId, $userId) {
        try {
            self::ensure($db);
            $db->query("SELECT receipt_no, invoice_id, amount, payment_method, reference_no FROM payment_receipts WHERE id = :id");
            $db->bind(':id', (int)$receiptId);
            $r = $db->single();
            if (!$r || $r->payment_method !== self::METHOD || empty($r->reference_no)) return;

            $db->query("SELECT id FROM gift_voucher_txns WHERE type = 'Restore' AND receipt_no = :r LIMIT 1");
            $db->bind(':r', $r->receipt_no);
            if ($db->single()) return;

            $db->beginTransaction();
            $v = self::byCode($db, $r->reference_no, true);
            if (!$v || $v->status === 'Void') { $db->commit(); return; }
            $after = round((float)$v->balance + (float)$r->amount, 2);
            $db->query("UPDATE gift_vouchers SET balance = :b, status = 'Active' WHERE id = :id");
            $db->bind(':b', $after);
            $db->bind(':id', (int)$v->id);
            $db->execute();
            self::txn($db, (int)$v->id, 'Restore', (float)$r->amount, $after, $r->invoice_id, $r->receipt_no, 'Receipt cancelled', $userId);
            $db->commit();
        } catch (Exception $e) {
            try { $db->rollBack(); } catch (Exception $e2) {}
            error_log('GiftVoucher restore: ' . $e->getMessage());
        }
    }

    private static function txn(Database $db, $voucherId, $type, $amount, $after, $invoiceId = null, $receiptNo = null, $notes = null, $userId = null) {
        $db->query("INSERT INTO gift_voucher_txns (voucher_id, type, amount, balance_after, invoice_id, receipt_no, notes, created_by)
                    VALUES (:v, :t, :a, :b, :i, :r, :n, :u)");
        $db->bind(':v', $voucherId);
        $db->bind(':t', $type);
        $db->bind(':a', round($amount, 2));
        $db->bind(':b', round($after, 2));
        $db->bind(':i', $invoiceId ?: null);
        $db->bind(':r', $receiptNo ?: null);
        $db->bind(':n', $notes);
        $db->bind(':u', $userId ?: null);
        $db->execute();
    }

    /**
     * Creates a voucher. $source 'Sold' (customer paid with $data['payment_method']) or 'Issued'
     * (given free: complimentary expense). Returns the voucher row.
     */
    public static function create(Database $db, array $data, $source, $userId) {
        self::ensure($db);
        $value = round((float)($data['value'] ?? 0), 2);
        if ($value <= 0) throw new Exception('Voucher value must be more than zero.');
        if ($value > 10000000) throw new Exception('Voucher value is too large.');
        $method = $source === 'Sold' ? trim((string)($data['payment_method'] ?? 'Cash')) : null;
        if ($source === 'Sold' && !in_array($method, ['Cash', 'Card', 'Bank Transfer'], true)) {
            throw new Exception('Pay for a gift voucher by cash, card or bank transfer.');
        }
        $expires = !empty($data['expires_at']) ? $data['expires_at'] : null;
        if ($expires && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $expires)) throw new Exception('Expiry date is not valid.');
        if ($expires && $expires < date('Y-m-d')) throw new Exception('Expiry date is in the past.');

        require_once __DIR__ . '/AccountingHelper.php';
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';
        $liability = AccountingHelper::giftVoucherAccountId();
        $other = $source === 'Sold' ? AccountingHelper::fundsAccount($method) : AccountingHelper::compExpenseAccountId();

        $db->beginTransaction();
        try {
            $code = !empty($data['code']) ? self::normalizeCode($data['code']) : self::generateCode($db);
            if (strlen($code) < 4) throw new Exception('Voucher code must be at least 4 characters.');
            if (self::byCode($db, $code)) throw new Exception("Voucher code {$code} already exists.");

            $db->query("INSERT INTO gift_vouchers (code, initial_value, balance, status, source, customer_id, recipient_name, recipient_phone, message, expires_at, location_id, payment_method, notes, created_by)
                        VALUES (:code, :v, :v2, 'Active', :src, :cust, :rn, :rp, :msg, :exp, :loc, :pm, :notes, :u)");
            $db->bind(':code', $code);
            $db->bind(':v', $value);
            $db->bind(':v2', $value);
            $db->bind(':src', $source);
            $db->bind(':cust', !empty($data['customer_id']) ? (int)$data['customer_id'] : null);
            $db->bind(':rn', mb_substr(trim((string)($data['recipient_name'] ?? '')), 0, 150) ?: null);
            $db->bind(':rp', mb_substr(trim((string)($data['recipient_phone'] ?? '')), 0, 40) ?: null);
            $db->bind(':msg', mb_substr(trim((string)($data['message'] ?? '')), 0, 255) ?: null);
            $db->bind(':exp', $expires);
            $db->bind(':loc', !empty($data['location_id']) ? (int)$data['location_id'] : null);
            $db->bind(':pm', $method);
            $db->bind(':notes', mb_substr(trim((string)($data['notes'] ?? '')), 0, 255) ?: null);
            $db->bind(':u', $userId ?: null);
            $db->execute();
            $id = (int)$db->lastInsertId();

            self::txn($db, $id, $source === 'Sold' ? 'Sale' : 'Issue', $value, $value, null, null, $method ? "Paid by {$method}" : 'Issued free', $userId);

            if ($liability && $other) {
                $ok = (new Journal())->post([
                    'entry_date' => date('Y-m-d'),
                    'description' => ($source === 'Sold' ? 'Gift voucher sold ' : 'Gift voucher issued ') . $code,
                    'ref_type' => 'GiftVoucher',
                    'ref_id' => $id,
                    'location_id' => !empty($data['location_id']) ? (int)$data['location_id'] : null,
                    'userId' => $userId,
                    'items' => [
                        ['account_id' => $other, 'debit' => $value, 'credit' => 0, 'notes' => $source === 'Sold' ? "Gift voucher {$code} paid by {$method}" : "Complimentary gift voucher {$code}"],
                        ['account_id' => $liability, 'debit' => 0, 'credit' => $value, 'notes' => "Gift voucher {$code} outstanding"],
                    ],
                ]);
                if (!$ok) error_log("GiftVoucher: journal not posted for {$code} (check account mappings / closed period)");
            }

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
        return self::byCode($db, $code);
    }

    /** Voids a voucher; any balance left is reversed against where it came from. */
    public static function void(Database $db, $id, $reason, $userId) {
        self::ensure($db);
        $reason = trim((string)$reason);
        if ($reason === '') throw new Exception('Give a reason for voiding the voucher.');

        require_once __DIR__ . '/AccountingHelper.php';
        require_once __DIR__ . '/../models/Journal.php';
        require_once __DIR__ . '/../models/Account.php';

        $db->beginTransaction();
        try {
            $db->query("SELECT * FROM gift_vouchers WHERE id = :id FOR UPDATE");
            $db->bind(':id', (int)$id);
            $v = $db->single();
            if (!$v) throw new Exception('Voucher not found.');
            if ($v->status === 'Void') throw new Exception('Voucher is already voided.');
            $left = round((float)$v->balance, 2);

            $db->query("UPDATE gift_vouchers SET status = 'Void', balance = 0, voided_at = NOW(), voided_by = :u, void_reason = :r WHERE id = :id");
            $db->bind(':u', $userId ?: null);
            $db->bind(':r', mb_substr($reason, 0, 255));
            $db->bind(':id', (int)$id);
            $db->execute();
            self::txn($db, (int)$id, 'Void', -$left, 0, null, null, $reason, $userId);

            if ($left > 0) {
                $liability = AccountingHelper::giftVoucherAccountId();
                $other = $v->source === 'Sold' ? AccountingHelper::fundsAccount($v->payment_method ?: 'Cash') : AccountingHelper::compExpenseAccountId();
                if ($liability && $other) {
                    (new Journal())->post([
                        'entry_date' => date('Y-m-d'),
                        'description' => "Gift voucher voided {$v->code}: {$reason}",
                        'ref_type' => 'GiftVoucherVoid',
                        'ref_id' => (int)$id,
                        'location_id' => $v->location_id ? (int)$v->location_id : null,
                        'userId' => $userId,
                        'items' => [
                            ['account_id' => $liability, 'debit' => $left, 'credit' => 0, 'notes' => "Gift voucher {$v->code} voided"],
                            ['account_id' => $other, 'debit' => 0, 'credit' => $left, 'notes' => $v->source === 'Sold' ? "Refund of gift voucher {$v->code}" : "Complimentary voucher {$v->code} reversed"],
                        ],
                    ]);
                }
            }
            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            throw $e;
        }
        return $left;
    }

    public static function listAll(Database $db, array $f = []) {
        self::ensure($db);
        $where = [];
        $binds = [];
        if (!empty($f['q'])) {
            $where[] = "(v.code LIKE :q OR v.recipient_name LIKE :q OR v.recipient_phone LIKE :q OR c.name LIKE :q)";
            $binds[':q'] = '%' . $f['q'] . '%';
        }
        $status = $f['status'] ?? '';
        if ($status === 'Expired') $where[] = "v.status = 'Active' AND v.expires_at IS NOT NULL AND v.expires_at < CURDATE()";
        elseif ($status === 'Active') $where[] = "v.status = 'Active' AND (v.expires_at IS NULL OR v.expires_at >= CURDATE())";
        elseif (in_array($status, ['Redeemed', 'Void'], true)) { $where[] = "v.status = :st"; $binds[':st'] = $status; }

        $db->query("SELECT v.*, c.name AS customer_name, u.name AS created_by_name
                    FROM gift_vouchers v
                    LEFT JOIN customers c ON c.id = v.customer_id
                    LEFT JOIN users u ON u.id = v.created_by
                    " . ($where ? 'WHERE ' . implode(' AND ', $where) : '') . "
                    ORDER BY v.id DESC LIMIT 500");
        foreach ($binds as $k => $val) $db->bind($k, $val);
        $rows = $db->resultSet();
        foreach ($rows as $r) $r->display_status = self::displayStatus($r);
        return $rows;
    }

    public static function detail(Database $db, $id) {
        self::ensure($db);
        $db->query("SELECT v.*, c.name AS customer_name FROM gift_vouchers v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.id = :id");
        $db->bind(':id', (int)$id);
        $v = $db->single();
        if (!$v) return null;
        $v->display_status = self::displayStatus($v);
        $db->query("SELECT t.*, i.invoice_no, u.name AS user_name FROM gift_voucher_txns t
                    LEFT JOIN invoices i ON i.id = t.invoice_id
                    LEFT JOIN users u ON u.id = t.created_by
                    WHERE t.voucher_id = :id ORDER BY t.id ASC");
        $db->bind(':id', (int)$id);
        $v->transactions = $db->resultSet();
        return $v;
    }

    public static function stats(Database $db) {
        self::ensure($db);
        $db->query("SELECT
                COALESCE(SUM(CASE WHEN status = 'Active' AND (expires_at IS NULL OR expires_at >= CURDATE()) THEN balance END), 0) AS outstanding,
                COALESCE(SUM(CASE WHEN status = 'Active' AND expires_at < CURDATE() THEN balance END), 0) AS expired_balance,
                COALESCE(SUM(initial_value), 0) AS issued_value,
                SUM(CASE WHEN status = 'Active' AND (expires_at IS NULL OR expires_at >= CURDATE()) THEN 1 ELSE 0 END) AS active_count,
                COUNT(*) AS total_count
            FROM gift_vouchers WHERE status <> 'Void'");
        $s = $db->single();
        $db->query("SELECT COALESCE(-SUM(amount), 0) AS v FROM gift_voucher_txns WHERE type = 'Redeem'");
        $red = (float)($db->single()->v ?? 0);
        $db->query("SELECT COALESCE(SUM(amount), 0) AS v FROM gift_voucher_txns WHERE type = 'Restore'");
        $red -= (float)($db->single()->v ?? 0);
        return [
            'outstanding' => (float)$s->outstanding,
            'expired_balance' => (float)$s->expired_balance,
            'issued_value' => (float)$s->issued_value,
            'redeemed_value' => round($red, 2),
            'active_count' => (int)$s->active_count,
            'total_count' => (int)$s->total_count,
        ];
    }

    /**
     * Money that moved through the till for vouchers on $date at the given locations.
     * Sales of vouchers bring money in; voiding a sold voucher pays its balance back out.
     * Issued (free) vouchers move no money and are left out.
     * Returns ['sales' => [...rows], 'refunds' => [...rows]]; each row has doc_no, amount,
     * payment_method, customer_name, created_at, type.
     */
    public static function dayMovements(Database $db, array $locIds, $date) {
        self::ensure($db);
        $locIds = array_values(array_filter(array_map('intval', $locIds)));
        if (!$locIds) return ['sales' => [], 'refunds' => []];
        $in = implode(',', $locIds);

        $db->query("SELECT id, code AS doc_no, initial_value AS amount, COALESCE(payment_method, 'Cash') AS payment_method,
                           recipient_name AS customer_name, created_at, 'Voucher Sale' AS type
                    FROM gift_vouchers
                    WHERE source = 'Sold' AND location_id IN ($in) AND DATE(created_at) = :d
                    ORDER BY created_at DESC");
        $db->bind(':d', $date);
        $sales = $db->resultSet();

        $db->query("SELECT t.id, v.code AS doc_no, -t.amount AS amount, COALESCE(v.payment_method, 'Cash') AS payment_method,
                           v.recipient_name AS customer_name, t.created_at, 'Voucher Refund' AS type
                    FROM gift_voucher_txns t
                    JOIN gift_vouchers v ON v.id = t.voucher_id
                    WHERE t.type = 'Void' AND t.amount < 0 AND v.source = 'Sold'
                      AND v.location_id IN ($in) AND DATE(t.created_at) = :d
                    ORDER BY t.created_at DESC");
        $db->bind(':d', $date);
        $refunds = $db->resultSet();

        return ['sales' => $sales, 'refunds' => $refunds];
    }
}
