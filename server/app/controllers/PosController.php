<?php
/**
 * PosController
 */
class PosController extends Controller {
    public function __construct() {
        // Ensure database tables exist for ledger queries
        require_once '../app/helpers/SalesReturnSchema.php';
        SalesReturnSchema::ensure();

        // Ensure database tables for Held Orders & KOT
        require_once '../app/helpers/PosHeldOrderSchema.php';
        PosHeldOrderSchema::ensure();
    }

    public function index() {
        $this->success(['message' => 'POS Controller Active']);
    }

    public function day_ledger() {
        $u = $this->requirePermission(['pos.read', 'orders.read']);
        $db = new Database();

        $locationId = (int)($_GET['location_id'] ?? 0);
        if ($locationId <= 0) {
            $this->error('Location ID required', 400);
            return;
        }

        // 1. Invoices (Sales)
        $db->query("
            SELECT i.id, i.invoice_no as doc_no, c.name as customer_name, i.grand_total as amount, i.created_at, 'Invoice' as type
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            WHERE i.location_id = :locId AND DATE(i.created_at) = CURDATE() AND i.status NOT IN ('Cancelled', 'CANCELLED')
            ORDER BY i.created_at DESC
        ");
        $db->bind(':locId', $locationId);
        $invoices = $db->resultSet();

        // 2. Returns
        $db->query("
            SELECT sr.id, sr.return_no as doc_no, 
                   COALESCE(c_i.name, c_sr.name) as customer_name, 
                   sr.total_amount as amount, sr.created_at, 'Return' as type
            FROM sales_returns sr
            LEFT JOIN invoices i ON sr.invoice_id = i.id
            LEFT JOIN customers c_i ON i.customer_id = c_i.id
            LEFT JOIN customers c_sr ON sr.customer_id = c_sr.id
            WHERE sr.location_id = :locId AND DATE(sr.created_at) = CURDATE() AND sr.status = 'Completed'
            ORDER BY sr.created_at DESC
        ");
        $db->bind(':locId', $locationId);
        $returns = $db->resultSet();

        // 3. Refunds
        $db->query("
            SELECT r.id, COALESCE(r.refund_no, CONCAT('REF-', LPAD(r.id, 5, '0'))) as doc_no, 
                   i.invoice_no, 
                   COALESCE(c_i.name, c_sr.name) as customer_name, 
                   r.amount, r.payment_method, r.created_at, 'Refund' as type
            FROM refunds r
            LEFT JOIN invoices i ON r.id = i.id
            LEFT JOIN sales_returns sr ON r.return_id = sr.id
            LEFT JOIN customers c_i ON i.customer_id = c_i.id
            LEFT JOIN customers c_sr ON sr.customer_id = c_sr.id
            WHERE r.location_id = :locId AND DATE(r.created_at) = CURDATE()
            ORDER BY r.created_at DESC
        ");
        $db->bind(':locId', $locationId);
        $refunds = $db->resultSet();

        // 4. Payment Receipts (individual payments)
        $db->query("
            SELECT id, receipt_no as doc_no, invoice_id, customer_name, amount, payment_method, created_at, 'Receipt' as type
            FROM payment_receipts
            WHERE location_id = :locId AND DATE(created_at) = CURDATE() AND status != 'Cancelled'
            ORDER BY created_at DESC
        ");
        $db->bind(':locId', $locationId);
        $receipts = $db->resultSet();

        // Calculate Totals and Method Summary
        $totalSales = array_reduce($invoices, function($s, $i) { return $s + (float)$i->amount; }, 0);
        $totalReturns = array_reduce($returns, function($s, $i) { return $s + (float)$i->amount; }, 0);
        $totalRefunds = array_reduce($refunds, function($s, $i) { return $s + (float)$i->amount; }, 0);

        $methods = [
            'Cash' => 0,
            'Card' => 0,
            'Bank Transfer' => 0,
            'Cheque' => 0,
            'Credit' => 0 // In case there are credit settlements
        ];

        // Add from Receipts
        foreach ($receipts as $r) {
            $m = $r->payment_method ?? 'Cash';
            if (!isset($methods[$m])) $methods[$m] = 0;
            $methods[$m] += (float)$r->amount;
        }

        // Subtract from Refunds
        foreach ($refunds as $r) {
            $m = $r->payment_method ?? 'Cash';
            if (!isset($methods[$m])) $methods[$m] = 0;
            $methods[$m] -= (float)$r->amount;
        }

        // Merge all events for chronological ledger
        $events = [];
        foreach ($invoices as $v) $events[] = $v;
        foreach ($returns as $v) $events[] = $v;
        foreach ($refunds as $v) $events[] = $v;
        foreach ($receipts as $v) $events[] = $v;

        // Sort by time
        usort($events, function($a, $b) {
            return strtotime($b->created_at) - strtotime($a->created_at);
        });

        $this->success([
            'summary' => [
                'sales' => $totalSales,
                'returns' => $totalReturns,
                'refunds' => $totalRefunds,
                'net' => $totalSales - $totalRefunds,
                'methods' => $methods
            ],
            'events' => $events
        ]);
    }

    public function held_orders() {
        $u = $this->requirePermission(['pos.read', 'orders.read']);
        $locationId = (int)($_GET['location_id'] ?? 1);
        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        $this->success($model->list($locationId));
    }

    public function hold_order() {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        $id = $model->save($data, $u['sub']);
        if ($id) {
            $this->success(['id' => $id, 'message' => 'Order held successfully']);
        } else {
            $this->error('Failed to hold order');
        }
    }

    public function load_held_order($id) {
        $u = $this->requirePermission(['pos.read', 'orders.read']);
        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        $order = $model->getById($id);
        if ($order) {
            $this->success($order);
        } else {
            $this->error('Held order not found');
        }
    }

    public function kot_details($id) {
        $u = $this->requirePermission(['pos.read', 'orders.read']);
        $full = ($_GET['full'] ?? '0') === '1';
        
        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        $order = $model->getById($id);
        if ($order) {
            if (!$full) {
                // Return ONLY unprinted items for incremental KOT
                $order->items = $model->getUnprintedKOTItems($id);
            }
            // If full, $order->items is already populated by getById() with all items

            // Removed (cancelled) items: new ones on an incremental KOT, all of them on a full reprint
            $order->voids = $model->getVoids($id, !$full);

            // Print stations (Kitchen KOT / Bar BOT ...): which tickets this KOT splits into.
            // ?station=ID returns only that station's part, with its ticket title.
            require_once '../app/helpers/PrintStationHelper.php';
            $groups = PrintStationHelper::group(new Database(), (int)$order->location_id, $order->items ?: [], $order->voids ?: []);
            $order->stations = array_map(function ($g) {
                $st = $g['station'];
                return [
                    'id' => $st ? (int)$st->id : null,
                    'name' => $st ? $st->name : null,
                    'ticket_label' => $st ? ($st->ticket_label ?: 'KOT') : 'KOT',
                    'printer_name' => $st ? $st->printer_name : null,
                    'paper_width' => $st ? ($st->paper_width ?: '80mm') : null,
                    'items' => count($g['items']),
                    'voids' => count($g['voids']),
                ];
            }, $groups);
            $order->ticket_label = 'KOT';
            $order->station_name = null;
            if (isset($_GET['station']) && $_GET['station'] !== '') {
                $want = (int)$_GET['station'];
                $order->items = []; $order->voids = [];
                foreach ($groups as $g) {
                    if ((int)($g['station']->id ?? 0) !== $want) continue;
                    $order->items = $g['items']; $order->voids = $g['voids'];
                    $order->ticket_label = $g['station']->ticket_label ?: 'KOT';
                    $order->station_name = $g['station']->name;
                }
            }

            $this->success($order);
        } else {
            $this->error('Held order not found');
        }
    }

    // ------------------------------------------------------------ Remove items after KOT (approved)
    // Who may approve: Admins, or users whose role has the "pos.void" permission, with a PIN set.

    private function canApproveVoid($userId) {
        $db = new Database();
        $db->query("
            SELECT u.id, u.is_active, u.pin_hash, r.name AS role,
                   (SELECT COUNT(*) FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id
                     WHERE rp.role_id = u.role_id AND p.perm_key = 'pos.void') AS has_void
            FROM users u INNER JOIN roles r ON r.id = u.role_id
            WHERE u.id = :id LIMIT 1
        ");
        $db->bind(':id', (int)$userId);
        $row = $db->single();
        if (!$row || (int)$row->is_active !== 1) return null;
        $ok = strtolower((string)$row->role) === 'admin' || (int)$row->has_void > 0;
        return $ok ? $row : null;
    }

    /**
     * Approver PIN check, sharing the lockout with the lock screen (5 wrong PINs = 5 minutes).
     * Sends the error response and returns false when the PIN is not accepted.
     */
    private function checkApproverPin($approverId, $pinHash, $pin) {
        $db = new Database();
        $db->query("SELECT pin_failed_count, pin_locked_until FROM users WHERE id = :id");
        $db->bind(':id', (int)$approverId);
        $lock = $db->single();
        if ($lock && !empty($lock->pin_locked_until) && strtotime($lock->pin_locked_until) > time()) {
            $this->error('Too many wrong PINs for this approver. Try again in a few minutes.', 423);
            return false;
        }
        if (!password_verify((string)$pin, (string)$pinHash)) {
            $fails = (int)($lock->pin_failed_count ?? 0) + 1;
            $blocked = $fails >= 5;
            $db->query("UPDATE users SET pin_failed_count = :f, pin_locked_until = :u WHERE id = :id");
            $db->bind(':f', $blocked ? 0 : $fails);
            $db->bind(':u', $blocked ? date('Y-m-d H:i:s', time() + 300) : null);
            $db->bind(':id', (int)$approverId);
            $db->execute();
            $this->error($blocked ? 'Too many wrong PINs. This approver is blocked for 5 minutes.' : 'Wrong approver PIN.', $blocked ? 423 : 401);
            return false;
        }
        $db->query("UPDATE users SET pin_failed_count = 0, pin_locked_until = NULL WHERE id = :id");
        $db->bind(':id', (int)$approverId);
        $db->execute();
        return true;
    }

    // ------------------------------------------------------------ Complimentary (comp) items
    // Who may approve: Admins (no limit), or users whose role has "pos.comp", with a PIN set.
    // A role's comp_limit caps the value of one approval (NULL = no limit).

    private function compApprover($userId) {
        require_once '../app/helpers/CompSchema.php';
        CompSchema::ensure();
        $db = new Database();
        $db->query("
            SELECT u.id, u.name, u.is_active, u.pin_hash, r.name AS role, r.comp_limit,
                   (SELECT COUNT(*) FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id
                     WHERE rp.role_id = u.role_id AND p.perm_key = 'pos.comp') AS has_comp
            FROM users u INNER JOIN roles r ON r.id = u.role_id
            WHERE u.id = :id LIMIT 1
        ");
        $db->bind(':id', (int)$userId);
        $row = $db->single();
        if (!$row || (int)$row->is_active !== 1) return null;
        $row->is_admin = strtolower((string)$row->role) === 'admin';
        return ($row->is_admin || (int)$row->has_comp > 0) ? $row : null;
    }

    // GET /api/pos/comp_approvers -> people who can approve a comp, with their limit (null = no limit)
    public function comp_approvers() {
        $this->requirePermission(['pos.read', 'pos.write']);
        require_once '../app/helpers/CompSchema.php';
        CompSchema::ensure();
        $db = new Database();
        $db->query("
            SELECT u.id, u.name, r.name AS role,
                   CASE WHEN LOWER(r.name) = 'admin' THEN NULL ELSE r.comp_limit END AS comp_limit
            FROM users u INNER JOIN roles r ON r.id = u.role_id
            WHERE u.is_active = 1 AND u.pin_hash IS NOT NULL
              AND (LOWER(r.name) = 'admin' OR EXISTS (
                    SELECT 1 FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = u.role_id AND p.perm_key = 'pos.comp'))
            ORDER BY u.name ASC
        ");
        $this->success($db->resultSet());
    }

    // POST /api/pos/approve_comp
    // { approver_id, approver_pin, reason, amount, held_order_id? }
    // Checks the approver's PIN and limit, then returns a one-time token. The invoice that settles
    // the comp lines presents the token; the server checks it there, so a comp can't be faked.
    public function approve_comp() {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $approverId = (int)($d['approver_id'] ?? 0);
        $pin = trim((string)($d['approver_pin'] ?? ''));
        $reason = trim(mb_substr((string)($d['reason'] ?? ''), 0, 255));
        $amount = round((float)($d['amount'] ?? 0), 2);
        $heldOrderId = !empty($d['held_order_id']) ? (int)$d['held_order_id'] : null;

        if ($amount <= 0) { $this->error('Nothing to make complimentary.', 400); return; }
        if ($reason === '') { $this->error('Please give a reason for the complimentary item.', 422); return; }

        $approver = $this->compApprover($approverId);
        if (!$approver || empty($approver->pin_hash)) { $this->error('This person can\'t approve complimentary items.', 403); return; }
        if (!$approver->is_admin && $approver->comp_limit !== null && $amount > (float)$approver->comp_limit + 0.001) {
            $this->error('This is over ' . $approver->name . '\'s complimentary limit of LKR ' . number_format((float)$approver->comp_limit, 2) . '. Ask a senior manager.', 403);
            return;
        }
        if (!$this->checkApproverPin($approverId, (string)$approver->pin_hash, $pin)) return;

        $token = bin2hex(random_bytes(20));
        $db = new Database();
        $db->query("
            INSERT INTO pos_comp_approvals (token, approver_id, requested_by, reason, amount_limit, held_order_id, expires_at)
            VALUES (:t, :a, :r, :reason, :amt, :h, :exp)
        ");
        $db->bind(':t', $token);
        $db->bind(':a', $approverId);
        $db->bind(':r', (int)$u['sub']);
        $db->bind(':reason', $reason);
        $db->bind(':amt', $amount);
        $db->bind(':h', $heldOrderId);
        // A held table can stay open for a while; the token still works until the bill is settled today/tonight
        $db->bind(':exp', date('Y-m-d H:i:s', time() + 24 * 3600));
        $db->execute();

        $this->success([
            'token' => $token,
            'approver_id' => $approverId,
            'approver_name' => $approver->name,
            'reason' => $reason,
            'amount' => $amount,
        ], 'Complimentary approved');
    }

    // GET /api/pos/comp_report?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=
    // Comps (settled bills) and voids (items removed after KOT) for the period.
    public function comp_report() {
        $this->requirePermission(['reports.read', 'pos.checkout', 'invoices.read']);
        require_once '../app/helpers/CompSchema.php';
        CompSchema::ensure();
        $from = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['from'] ?? '') ? $_GET['from'] : date('Y-m-01');
        $to = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['to'] ?? '') ? $_GET['to'] : date('Y-m-d');
        $loc = !empty($_GET['location_id']) ? (int)$_GET['location_id'] : null;

        $db = new Database();
        $db->query("
            SELECT ii.id, i.id AS invoice_id, i.invoice_no, i.issue_date, i.created_at, ii.description, ii.quantity,
                   ii.comp_amount AS amount, COALESCE(ii.display_unit_price, ii.unit_price) AS unit_price,
                   ii.comp_reason AS reason, ua.name AS approved_by, uc.name AS billed_by, st.name AS steward,
                   rt.name AS table_name, sl.name AS location_name
            FROM invoice_items ii
            INNER JOIN invoices i ON i.id = ii.invoice_id
            LEFT JOIN users ua ON ua.id = ii.comp_approved_by
            LEFT JOIN users uc ON uc.id = i.created_by
            LEFT JOIN users st ON st.id = i.steward_id
            LEFT JOIN restaurant_tables rt ON rt.id = i.table_id
            LEFT JOIN service_locations sl ON sl.id = i.location_id
            WHERE ii.is_complimentary = 1 AND i.status <> 'Cancelled'
              AND DATE(i.created_at) BETWEEN :f AND :t" . ($loc ? " AND i.location_id = :loc" : "") . "
            ORDER BY i.created_at DESC
        ");
        $db->bind(':f', $from);
        $db->bind(':t', $to);
        if ($loc) $db->bind(':loc', $loc);
        $comps = $db->resultSet() ?: [];

        $voids = [];
        try {
            $db->query("
                SELECT v.id, v.held_order_id, v.description, v.quantity, v.unit_price,
                       ROUND(v.quantity * v.unit_price, 2) AS amount, v.reason, v.created_at,
                       ua.name AS approved_by, ur.name AS removed_by, rt.name AS table_name, sl.name AS location_name
                FROM pos_held_order_voids v
                INNER JOIN pos_held_orders o ON o.id = v.held_order_id
                LEFT JOIN users ua ON ua.id = v.approved_by
                LEFT JOIN users ur ON ur.id = v.removed_by
                LEFT JOIN restaurant_tables rt ON rt.id = o.table_id
                LEFT JOIN service_locations sl ON sl.id = o.location_id
                WHERE DATE(v.created_at) BETWEEN :f AND :t" . ($loc ? " AND o.location_id = :loc" : "") . "
                ORDER BY v.created_at DESC
            ");
            $db->bind(':f', $from);
            $db->bind(':t', $to);
            if ($loc) $db->bind(':loc', $loc);
            $voids = $db->resultSet() ?: [];
        } catch (Exception $e) { /* voids table not on this install */ }

        $this->success(['from' => $from, 'to' => $to, 'comps' => $comps, 'voids' => $voids]);
    }

    // GET /api/pos/void_approvers  -> people who can approve a removal (have permission + PIN)
    public function void_approvers() {
        $this->requirePermission(['pos.read', 'pos.write']);
        $db = new Database();
        $db->query("
            SELECT u.id, u.name, r.name AS role
            FROM users u INNER JOIN roles r ON r.id = u.role_id
            WHERE u.is_active = 1 AND u.pin_hash IS NOT NULL
              AND (LOWER(r.name) = 'admin' OR EXISTS (
                    SELECT 1 FROM role_permissions rp INNER JOIN permissions p ON p.id = rp.permission_id
                    WHERE rp.role_id = u.role_id AND p.perm_key = 'pos.void'))
            ORDER BY u.name ASC
        ");
        $this->success($db->resultSet());
    }

    // POST /api/pos/void_held_item
    // { held_item_id, quantity, reason, approver_id, approver_pin }
    // Removes (or reduces) an item already sent to the kitchen, after the approver's PIN check.
    // The removal is recorded so the next KOT prints it as CANCELLED with the approver's name.
    public function void_held_item() {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $heldItemId = (int)($d['held_item_id'] ?? 0);
        $qty = round((float)($d['quantity'] ?? 0), 3);
        $reason = trim(mb_substr((string)($d['reason'] ?? ''), 0, 255));
        $approverId = (int)($d['approver_id'] ?? 0);
        $pin = trim((string)($d['approver_pin'] ?? ''));

        if ($heldItemId <= 0 || $qty <= 0) { $this->error('Item and quantity are required.', 400); return; }
        if ($reason === '') { $this->error('Please give a reason for removing the item.', 422); return; }

        $approver = $this->canApproveVoid($approverId);
        if (!$approver || empty($approver->pin_hash)) { $this->error('This person can\'t approve removals.', 403); return; }
        if (!$this->checkApproverPin($approverId, (string)$approver->pin_hash, $pin)) return;

        $db = new Database();

        // The held line
        $db->query("SELECT * FROM pos_held_order_items WHERE id = :id LIMIT 1");
        $db->bind(':id', $heldItemId);
        $item = $db->single();
        if (!$item) { $this->error('That item is no longer on the bill.', 404); return; }
        if ($qty > (float)$item->quantity + 0.0001) { $this->error('Can\'t remove more than is on the bill.', 422); return; }

        $db->beginTransaction();
        try {
            $remaining = round((float)$item->quantity - $qty, 3);
            if ($remaining <= 0) {
                $db->query("DELETE FROM pos_held_order_items WHERE id = :id");
                $db->bind(':id', $heldItemId);
            } else {
                $db->query("UPDATE pos_held_order_items SET quantity = :q, line_total = :t, kot_printed_qty = LEAST(kot_printed_qty, :q2) WHERE id = :id");
                $db->bind(':q', $remaining);
                $db->bind(':q2', $remaining);
                $db->bind(':t', round($remaining * ((float)$item->unit_price - (float)$item->discount), 2));
                $db->bind(':id', $heldItemId);
            }
            $db->execute();

            $db->query("
                INSERT INTO pos_held_order_voids
                    (held_order_id, held_item_id, item_id, description, quantity, unit_price, reason, removed_by, approved_by)
                VALUES (:o, :hi, :i, :d, :q, :p, :r, :rb, :ab)
            ");
            $db->bind(':o', (int)$item->held_order_id);
            $db->bind(':hi', $heldItemId);
            $db->bind(':i', $item->item_id);
            $db->bind(':d', $item->description);
            $db->bind(':q', $qty);
            $db->bind(':p', $item->unit_price);
            $db->bind(':r', $reason);
            $db->bind(':rb', (int)$u['sub']);
            $db->bind(':ab', $approverId);
            $db->execute();

            // Keep the held bill totals right
            $db->query("
                UPDATE pos_held_orders o SET subtotal = COALESCE((SELECT SUM(quantity * unit_price) FROM pos_held_order_items WHERE held_order_id = o.id), 0)
                WHERE o.id = :o
            ");
            $db->bind(':o', (int)$item->held_order_id);
            $db->execute();

            $db->commit();
        } catch (Exception $e) {
            $db->rollBack();
            $this->error('Could not remove the item: ' . $e->getMessage(), 500);
            return;
        }

        $this->success([
            'held_order_id' => (int)$item->held_order_id,
            'remaining_quantity' => max(0, $remaining),
            'approved_by' => $approverId,
        ], 'Item removed');
    }

    public function mark_kot_printed($id) {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        if ($model->markAsPrinted($id)) {
            $this->success(['message' => 'KOT marked as printed']);
        } else {
            $this->error('Failed to mark KOT as printed');
        }
    }

    public function stewards() {
        $u = $this->requireAuth();
        $locationId = $this->currentLocationId($u);
        
        $db = new Database();
        $db->query("
            SELECT u.id, u.name, u.email, r.name as role_name
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            WHERE u.location_id = :locId
              AND u.is_active = 1
            ORDER BY u.name ASC
        ");
        $db->bind(':locId', $locationId);
        $rows = $db->resultSet();
        
        // Filter by role in PHP to avoid SQL case/trim issues
        $filtered = array_values(array_filter($rows, function($row) {
            $role = strtolower(trim($row->role_name));
            return (
                strpos($role, 'steward') !== false || 
                strpos($role, 'officer') !== false || 
                strpos($role, 'waiter') !== false
            );
        }));
        
        $this->success($filtered);
    }
}
