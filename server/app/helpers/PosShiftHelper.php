<?php
/**
 * PosShiftHelper - cashier shifts (cash drawer sessions).
 *
 * A cashier opens a shift with the cash already in the drawer (opening float), takes payments,
 * can record cash put in or taken out (pay in / pay out), and closes the shift by counting the
 * drawer. Expected cash is worked out from what that cashier did at that location since the shift
 * opened; the difference to the count is the variance (over / short).
 *
 * Expected cash = opening float
 *               + cash payment receipts taken by the cashier
 *               + gift vouchers sold for cash
 *               + pay ins - pay outs
 *               - cash refunds (sales returns) and cash credit-note refunds
 *
 * Tables (created on first use): pos_shifts, pos_shift_cash_moves, pos_terminals.
 *
 * Terminals (cash drawers): each POS PC is registered as a terminal and sends X-Terminal-Id.
 *  - A shift then belongs to the terminal (drawer), not the cashier: one open shift per terminal;
 *    any cashier on that terminal sells into it and can close it.
 *  - Documents created on a terminal (payment receipts, refunds, vouchers, credit-note refunds,
 *    invoices) are stamped with terminal_id at the end of the request (tagRequest), and the
 *    terminal's expected cash is counted from those.
 *  - Without a terminal header the old rule applies: one open shift per cashier per location.
 */
class PosShiftHelper {
    private static $ready = false;

    public static function ensure(Database $db) {
        if (self::$ready) return;
        self::$ready = true;
        self::ensureBase($db);
        self::ensureTerminals($db);
    }

    /** Tables holding documents a terminal can create (table => has location_id). */
    private static $stampTables = [
        'payment_receipts' => true, 'refunds' => true, 'gift_vouchers' => true,
        'invoices' => true, 'credit_note_allocations' => false,
    ];

    private static function ensureTerminals(Database $db) {
        try {
            $db->query("SELECT terminal_id FROM pos_shifts LIMIT 1");
            $db->execute();
            return;
        } catch (PDOException $e) { /* migrate below */ }
        $sql = [
            "CREATE TABLE IF NOT EXISTS pos_terminals (
                id INT AUTO_INCREMENT PRIMARY KEY,
                location_id INT NOT NULL,
                name VARCHAR(80) NOT NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_term_loc (location_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];
        foreach (array_keys(self::$stampTables) as $t) {
            $sql[] = "ALTER TABLE `$t` ADD COLUMN terminal_id INT NULL, ADD INDEX idx_{$t}_term (terminal_id)";
        }
        // Last: its presence marks the migration done.
        $sql[] = "ALTER TABLE pos_shifts ADD COLUMN terminal_id INT NULL AFTER location_id, ADD INDEX idx_shift_term (terminal_id, status)";
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('PosShift terminal schema: ' . $e->getMessage()); }
        }
    }

    private static function ensureBase(Database $db) {
        try {
            $db->query("SELECT 1 FROM pos_shift_cash_moves LIMIT 1");
            $db->execute();
            return;
        } catch (PDOException $e) { /* create below */ }
        $sql = [
            "CREATE TABLE IF NOT EXISTS pos_shifts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_no VARCHAR(40) NOT NULL,
                location_id INT NOT NULL,
                user_id INT NOT NULL,
                opened_at DATETIME NOT NULL,
                opening_float DECIMAL(12,2) NOT NULL DEFAULT 0,
                closed_at DATETIME NULL,
                expected_cash DECIMAL(12,2) NULL,
                counted_cash DECIMAL(12,2) NULL,
                variance DECIMAL(12,2) NULL,
                denominations TEXT NULL,
                summary TEXT NULL,
                close_notes VARCHAR(255) NULL,
                closed_by INT NULL,
                status ENUM('Open','Closed') NOT NULL DEFAULT 'Open',
                INDEX idx_shift_user (user_id, location_id, status),
                INDEX idx_shift_opened (opened_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
            "CREATE TABLE IF NOT EXISTS pos_shift_cash_moves (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shift_id INT NOT NULL,
                type ENUM('PayIn','PayOut') NOT NULL,
                amount DECIMAL(12,2) NOT NULL,
                reason VARCHAR(255) NOT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_scm_shift (shift_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
        ];
        foreach ($sql as $q) {
            try { $db->query($q); $db->execute(); }
            catch (Exception $e) { error_log('PosShift schema: ' . $e->getMessage()); }
        }
    }

    // ---- Terminals ---------------------------------------------------------------------------

    /** Live terminals at one location (int) or several (array of ids), with their open shift. */
    public static function terminals(Database $db, $locationIds) {
        $ids = array_values(array_filter(array_map('intval', (array)$locationIds)));
        if (!$ids) return [];
        $in = implode(',', $ids);
        $db->query("SELECT t.id, t.location_id, l.name AS location_name, t.name,
                           (SELECT s.shift_no FROM pos_shifts s WHERE s.terminal_id = t.id AND s.status = 'Open' ORDER BY s.id DESC LIMIT 1) AS open_shift_no
                    FROM pos_terminals t LEFT JOIN service_locations l ON l.id = t.location_id
                    WHERE t.location_id IN ($in) AND t.is_active = 1 ORDER BY l.name, t.name");
        return $db->resultSet();
    }

    /**
     * Back-office live view: each terminal with its open shift (float, cash, expected cash, payments)
     * and today's sales stamped with the terminal.
     */
    public static function terminalsReport(Database $db, $locationIds) {
        $rows = self::terminals($db, $locationIds);
        if (!$rows) return [];
        $ids = implode(',', array_map(function ($t) { return (int)$t->id; }, $rows));

        $today = [];
        try {
            $db->query("SELECT terminal_id, COUNT(*) AS n, COALESCE(SUM(grand_total),0) AS total FROM invoices
                        WHERE terminal_id IN ($ids) AND DATE(created_at) = CURDATE() AND status NOT IN ('Cancelled','CANCELLED')
                        GROUP BY terminal_id");
            foreach ($db->resultSet() as $r) $today[(int)$r->terminal_id] = ['count' => (int)$r->n, 'total' => round((float)$r->total, 2)];
        } catch (Exception $e) { /* column not there yet */ }

        $shifts = [];
        $db->query("SELECT s.*, u.name AS user_name FROM pos_shifts s LEFT JOIN users u ON u.id = s.user_id
                    WHERE s.terminal_id IN ($ids) AND s.status = 'Open'");
        foreach ($db->resultSet() as $s) $shifts[(int)$s->terminal_id] = $s;

        foreach ($rows as $t) {
            $t->today = $today[(int)$t->id] ?? ['count' => 0, 'total' => 0];
            $s = $shifts[(int)$t->id] ?? null;
            $t->shift = $s ? [
                'id' => (int)$s->id, 'shift_no' => $s->shift_no, 'opened_at' => $s->opened_at,
                'opened_by' => $s->user_name, 'summary' => self::summary($db, $s),
            ] : null;
        }
        return $rows;
    }

    public static function terminal(Database $db, $id) {
        if ((int)$id <= 0) return null;
        $db->query("SELECT * FROM pos_terminals WHERE id = :id AND is_active = 1");
        $db->bind(':id', (int)$id);
        return $db->single() ?: null;
    }

    public static function saveTerminal(Database $db, $locationId, $name, $userId, $id = 0) {
        $name = mb_substr(trim((string)$name), 0, 80);
        $id = (int)$id;
        if ($name === '') throw new Exception('Give the terminal a name.');
        if ((int)$locationId <= 0) throw new Exception('Choose a location first.');
        $db->query("SELECT id FROM pos_terminals WHERE location_id = :l AND name = :n AND is_active = 1 AND id <> :id");
        $db->bind(':l', (int)$locationId); $db->bind(':n', $name); $db->bind(':id', $id);
        if ($db->single()) throw new Exception('A terminal with this name already exists here.');
        if ($id) {
            // Rename and/or move to another location (not while a shift is open on it).
            $cur = self::terminal($db, $id);
            if (!$cur) throw new Exception('Terminal not found.');
            if ((int)$cur->location_id !== (int)$locationId) {
                $db->query("SELECT id FROM pos_shifts WHERE terminal_id = :id AND status = 'Open' LIMIT 1");
                $db->bind(':id', $id);
                if ($db->single()) throw new Exception('Close the open shift before moving this terminal to another location.');
            }
            $db->query("UPDATE pos_terminals SET name = :n, location_id = :l WHERE id = :id");
            $db->bind(':id', $id);
        } else {
            $db->query("INSERT INTO pos_terminals (location_id, name, created_by) VALUES (:l, :n, :u)");
            $db->bind(':u', $userId ?: null);
        }
        $db->bind(':l', (int)$locationId); $db->bind(':n', $name);
        $db->execute();
        return self::terminal($db, $id ?: (int)$db->lastInsertId());
    }

    public static function removeTerminal(Database $db, $id, $locationId) {
        $db->query("SELECT id FROM pos_shifts WHERE terminal_id = :id AND status = 'Open' LIMIT 1");
        $db->bind(':id', (int)$id);
        if ($db->single()) throw new Exception('Close the open shift on this terminal first.');
        $db->query("UPDATE pos_terminals SET is_active = 0 WHERE id = :id AND location_id = :l");
        $db->bind(':id', (int)$id); $db->bind(':l', (int)$locationId);
        $db->execute();
        if (!$db->rowCount()) throw new Exception('Terminal not found.');
    }

    /** Terminal named by X-Terminal-Id, if it is a live terminal at this location. */
    public static function requestTerminal(Database $db, $locationId) {
        $tid = (int)($_SERVER['HTTP_X_TERMINAL_ID'] ?? 0);
        if ($tid <= 0) return null;
        $t = self::terminal($db, $tid);
        return ($t && (int)$t->location_id === (int)$locationId) ? $t : null;
    }

    /**
     * Stamp the documents a request created with its terminal. Runs at shutdown of write requests
     * that carry X-Terminal-Id: rows by this user, at the terminal's location, created since the
     * request started and not stamped yet.
     */
    public static function tagRequest($userId, $terminalId, $since) {
        $userId = (int)$userId; $terminalId = (int)$terminalId;
        if ($userId <= 0 || $terminalId <= 0) return;
        try {
            $db = new Database();
            $t = self::terminal($db, $terminalId);
            if (!$t) return;
            foreach (self::$stampTables as $table => $hasLoc) {
                try {
                    $db->query("UPDATE `$table` SET terminal_id = :t
                                WHERE terminal_id IS NULL AND created_by = :u AND created_at >= :since" . ($hasLoc ? " AND location_id = :l" : ""));
                    $db->bind(':t', $terminalId); $db->bind(':u', $userId); $db->bind(':since', $since);
                    if ($hasLoc) $db->bind(':l', (int)$t->location_id);
                    $db->execute();
                } catch (Exception $e) { /* table or column missing: skip */ }
            }
        } catch (Throwable $e) { error_log('PosShift tagRequest: ' . $e->getMessage()); }
    }

    // ---- Shifts ------------------------------------------------------------------------------

    /** Open shift of this terminal (when given), else of this cashier at this location. */
    public static function current(Database $db, $userId, $locationId, $terminalId = null) {
        $sql = "SELECT s.*, u.name AS user_name, t.name AS terminal_name FROM pos_shifts s
                LEFT JOIN users u ON u.id = s.user_id LEFT JOIN pos_terminals t ON t.id = s.terminal_id
                WHERE s.location_id = :l AND s.status = 'Open' AND ";
        if ($terminalId) {
            $db->query($sql . "s.terminal_id = :t ORDER BY s.id DESC LIMIT 1");
            $db->bind(':t', (int)$terminalId);
        } else {
            $db->query($sql . "s.user_id = :u AND s.terminal_id IS NULL ORDER BY s.id DESC LIMIT 1");
            $db->bind(':u', (int)$userId);
        }
        $db->bind(':l', (int)$locationId);
        $s = $db->single();
        if (!$s) return null;
        $s->summary_live = self::summary($db, $s);
        return $s;
    }

    public static function open(Database $db, $userId, $locationId, $float, $terminalId = null) {
        $float = round((float)$float, 2);
        if ($float < 0) throw new Exception('Opening cash cannot be negative.');
        if ($locationId <= 0) throw new Exception('Choose a location first.');
        $cur = self::current($db, $userId, $locationId, $terminalId);
        if ($cur) throw new Exception($terminalId ? 'This terminal already has an open shift (' . $cur->shift_no . ').' : 'You already have an open shift here.');
        $db->query("SELECT COUNT(*) AS n FROM pos_shifts WHERE location_id = :l AND DATE(opened_at) = CURDATE()");
        $db->bind(':l', (int)$locationId);
        $n = (int)$db->single()->n + 1;
        $no = 'SH-' . date('ymd') . '-' . (int)$locationId . '-' . str_pad((string)$n, 2, '0', STR_PAD_LEFT);
        $db->query("INSERT INTO pos_shifts (shift_no, location_id, terminal_id, user_id, opened_at, opening_float) VALUES (:no, :l, :t, :u, NOW(), :f)");
        $db->bind(':no', $no);
        $db->bind(':l', (int)$locationId);
        $db->bind(':t', $terminalId ? (int)$terminalId : null);
        $db->bind(':u', (int)$userId);
        $db->bind(':f', $float);
        $db->execute();
        return self::current($db, $userId, $locationId, $terminalId);
    }

    public static function cashMove(Database $db, $shift, $type, $amount, $reason, $userId) {
        $amount = round((float)$amount, 2);
        $reason = trim((string)$reason);
        if (!in_array($type, ['PayIn', 'PayOut'], true)) throw new Exception('Choose pay in or pay out.');
        if ($amount <= 0) throw new Exception('Enter an amount more than zero.');
        if ($reason === '') throw new Exception('Give a reason.');
        $db->query("INSERT INTO pos_shift_cash_moves (shift_id, type, amount, reason, created_by) VALUES (:s, :t, :a, :r, :u)");
        $db->bind(':s', (int)$shift->id);
        $db->bind(':t', $type);
        $db->bind(':a', $amount);
        $db->bind(':r', mb_substr($reason, 0, 255));
        $db->bind(':u', $userId ?: null);
        $db->execute();
    }

    private static function sumOrZero(Database $db, $sql, array $binds) {
        try {
            $db->query($sql);
            foreach ($binds as $k => $v) $db->bind($k, $v);
            return round((float)($db->single()->v ?? 0), 2);
        } catch (Exception $e) {
            return 0.0; // table not created yet (feature never used)
        }
    }

    /** What the drawer should hold, plus the other payment methods for the report. */
    public static function summary(Database $db, $s, $until = null) {
        // Terminal shift: documents stamped with the terminal. Cashier shift: documents by the cashier.
        $byTerm = !empty($s->terminal_id);
        $b = [':u' => $byTerm ? (int)$s->terminal_id : (int)$s->user_id, ':l' => (int)$s->location_id, ':from' => $s->opened_at, ':to' => $until ?: date('Y-m-d H:i:s')];
        $who = $byTerm ? 'terminal_id = :u' : 'created_by = :u';

        $methods = [];
        try {
            $db->query("SELECT payment_method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS n
                        FROM payment_receipts
                        WHERE {$who} AND location_id = :l AND created_at BETWEEN :from AND :to
                          AND (status IS NULL OR status NOT IN ('Cancelled','CANCELLED'))
                        GROUP BY payment_method");
            foreach ($b as $k => $v) $db->bind($k, $v);
            foreach ($db->resultSet() as $r) $methods[$r->payment_method ?: 'Cash'] = ['total' => round((float)$r->total, 2), 'count' => (int)$r->n];
        } catch (Exception $e) { /* keep empty */ }

        $cashSales = $methods['Cash']['total'] ?? 0;
        $voucherCash = self::sumOrZero($db, "SELECT COALESCE(SUM(initial_value),0) AS v FROM gift_vouchers
                        WHERE source = 'Sold' AND payment_method = 'Cash' AND {$who} AND location_id = :l AND created_at BETWEEN :from AND :to", $b);
        $refunds = self::sumOrZero($db, "SELECT COALESCE(SUM(amount),0) AS v FROM refunds
                        WHERE payment_method = 'Cash' AND {$who} AND location_id = :l AND created_at BETWEEN :from AND :to", $b);
        $cnRefunds = self::sumOrZero($db, "SELECT COALESCE(SUM(a.amount),0) AS v FROM credit_note_allocations a JOIN credit_notes cn ON cn.id = a.credit_note_id
                        WHERE a.type = 'Refund' AND a.payment_method = 'Cash' AND a.{$who} AND cn.location_id = :l AND a.created_at BETWEEN :from AND :to", $b);
        $sb = [':s' => (int)$s->id];
        $payIn = self::sumOrZero($db, "SELECT COALESCE(SUM(amount),0) AS v FROM pos_shift_cash_moves WHERE shift_id = :s AND type = 'PayIn'", $sb);
        $payOut = self::sumOrZero($db, "SELECT COALESCE(SUM(amount),0) AS v FROM pos_shift_cash_moves WHERE shift_id = :s AND type = 'PayOut'", $sb);

        $invoices = self::sumOrZero($db, "SELECT COUNT(*) AS v FROM invoices
                        WHERE {$who} AND location_id = :l AND created_at BETWEEN :from AND :to AND status NOT IN ('Cancelled','CANCELLED')", $b);
        $sales = self::sumOrZero($db, "SELECT COALESCE(SUM(grand_total),0) AS v FROM invoices
                        WHERE {$who} AND location_id = :l AND created_at BETWEEN :from AND :to AND status NOT IN ('Cancelled','CANCELLED')", $b);

        $db->query("SELECT type, amount, reason, created_at FROM pos_shift_cash_moves WHERE shift_id = :s ORDER BY id");
        $db->bind(':s', (int)$s->id);
        $moves = $db->resultSet();

        $expected = round((float)$s->opening_float + $cashSales + $voucherCash + $payIn - $payOut - $refunds - $cnRefunds, 2);
        return [
            'opening_float' => round((float)$s->opening_float, 2),
            'cash_sales' => $cashSales,
            'voucher_cash' => $voucherCash,
            'pay_in' => $payIn,
            'pay_out' => $payOut,
            'cash_refunds' => round($refunds + $cnRefunds, 2),
            'expected_cash' => $expected,
            'methods' => $methods,
            'invoice_count' => (int)$invoices,
            'sales_total' => $sales,
            'moves' => $moves,
        ];
    }

    public static function close(Database $db, $shift, $counted, $denoms, $notes, $userId) {
        $counted = round((float)$counted, 2);
        if ($counted < 0) throw new Exception('Counted cash cannot be negative.');
        $now = date('Y-m-d H:i:s');
        $sum = self::summary($db, $shift, $now);
        $variance = round($counted - $sum['expected_cash'], 2);
        $notes = trim((string)$notes);
        if (abs($variance) >= 0.01 && $notes === '') throw new Exception('The count does not match. Add a note explaining the difference.');
        $db->query("UPDATE pos_shifts SET status = 'Closed', closed_at = :t, expected_cash = :e, counted_cash = :c, variance = :v,
                        denominations = :d, summary = :s, close_notes = :n, closed_by = :u
                    WHERE id = :id AND status = 'Open'");
        $db->bind(':t', $now);
        $db->bind(':e', $sum['expected_cash']);
        $db->bind(':c', $counted);
        $db->bind(':v', $variance);
        $db->bind(':d', $denoms ? json_encode($denoms) : null);
        $db->bind(':s', json_encode($sum));
        $db->bind(':n', $notes !== '' ? mb_substr($notes, 0, 255) : null);
        $db->bind(':u', $userId ?: null);
        $db->bind(':id', (int)$shift->id);
        $db->execute();
        return self::detail($db, (int)$shift->id);
    }

    public static function detail(Database $db, $id) {
        $db->query("SELECT s.*, u.name AS user_name, l.name AS location_name, t.name AS terminal_name FROM pos_shifts s
                    LEFT JOIN users u ON u.id = s.user_id LEFT JOIN service_locations l ON l.id = s.location_id
                    LEFT JOIN pos_terminals t ON t.id = s.terminal_id WHERE s.id = :id");
        $db->bind(':id', (int)$id);
        $s = $db->single();
        if (!$s) return null;
        $s->summary = $s->summary ? json_decode($s->summary, true) : self::summary($db, $s);
        $s->denominations = $s->denominations ? json_decode($s->denominations, true) : null;
        return $s;
    }

    public static function listAll(Database $db, array $locIds, $from, $to) {
        $locIds = array_values(array_filter(array_map('intval', $locIds)));
        if (!$locIds) return [];
        $in = implode(',', $locIds);
        $db->query("SELECT s.id, s.shift_no, s.location_id, l.name AS location_name, s.terminal_id, t.name AS terminal_name, s.user_id, u.name AS user_name,
                           s.opened_at, s.closed_at, s.opening_float, s.expected_cash, s.counted_cash, s.variance, s.status, s.close_notes
                    FROM pos_shifts s LEFT JOIN users u ON u.id = s.user_id LEFT JOIN service_locations l ON l.id = s.location_id
                    LEFT JOIN pos_terminals t ON t.id = s.terminal_id
                    WHERE s.location_id IN ($in) AND DATE(s.opened_at) BETWEEN :f AND :t
                    ORDER BY s.opened_at DESC LIMIT 500");
        $db->bind(':f', $from);
        $db->bind(':t', $to);
        return $db->resultSet();
    }
}
