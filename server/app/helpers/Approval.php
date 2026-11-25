<?php
require_once __DIR__ . '/ApprovalSchema.php';

/**
 * Approval workflow engine.
 *
 * Each document type can be switched on in Approvals & Control > Approval Rules and given
 * ordered levels. A level's approver is a role (anyone holding it) or one named person, and it
 * can apply only from a minimum amount and/or to one location. Levels run in order; a level
 * that doesn't apply to a document (amount below its minimum, other location) is skipped.
 *
 * A module calls Approval::submit() when a document needs approval. If the type is off, or no
 * level applies, the document is approved straight away. Otherwise it waits; each approval moves
 * it to the next applicable level, and the last one calls the type's onApproved handler.
 * A rejection calls onRejected. Admins can act at any level.
 */
class Approval {
    /** Supported document types. `handler` methods live in ApprovalHandlers below. */
    const TYPES = [
        'purchase_order'   => ['label' => 'Purchase orders',     'href' => '/inventory/purchase-orders/%d'],
        'expense'          => ['label' => 'Expense vouchers',    'href' => '/accounting/expenses?voucher=%d'],
        'stock_adjustment' => ['label' => 'Stock adjustments',   'href' => '/inventory/adjustments/%d'],
        'stock_count'      => ['label' => 'Stock counts',        'href' => '/inventory/stock-counts/%d'],
        'stock_requisition' => ['label' => 'Stock requests (between locations)', 'href' => '/inventory/stock-requests/%d'],
        'cancellation'     => ['label' => 'Cancellations',       'href' => '/approvals/cancellations?id=%d'],
        'discount'         => ['label' => 'Discounts over limit', 'href' => '/cms/invoices/%d/view'],
    ];

    private static function db() { ApprovalSchema::ensure(); return new Database(); }

    public static function isEnabled(string $type): bool {
        $db = self::db();
        $db->query("SELECT enabled FROM approval_doc_types WHERE doc_type = :t");
        $db->bind(':t', $type);
        return (int)($db->singleColumn() ?: 0) === 1;
    }

    /** Levels that apply to a document of this amount / location, in order. */
    public static function levelsFor(string $type, ?float $amount, ?int $locationId): array {
        $db = self::db();
        $db->query("SELECT * FROM approval_levels WHERE doc_type = :t ORDER BY level_no, id");
        $db->bind(':t', $type);
        return array_values(array_filter($db->resultSet() ?: [], function ($l) use ($amount, $locationId) {
            if ($l->min_amount !== null && ($amount === null || $amount < (float)$l->min_amount)) return false;
            if ($l->location_id !== null && $locationId !== null && (int)$l->location_id !== $locationId) return false;
            return true;
        }));
    }

    /** Latest request for a document, or null. */
    public static function forDocument(string $type, int $docId) {
        $db = self::db();
        $db->query("SELECT * FROM approval_requests WHERE doc_type = :t AND doc_id = :d ORDER BY id DESC LIMIT 1");
        $db->bind(':t', $type); $db->bind(':d', $docId);
        return $db->single() ?: null;
    }

    /**
     * Send a document for approval.
     * Returns ['status' => 'Approved'|'Pending', 'request_id' => ?int, 'level' => ?string].
     * 'Approved' means no approval is needed (type off or no level applies); the caller proceeds.
     */
    public static function submit(string $type, int $docId, array $doc, int $userId): array {
        if (!isset(self::TYPES[$type])) throw new InvalidArgumentException("Unknown approval type $type");
        $amount = isset($doc['amount']) ? (float)$doc['amount'] : null;
        $loc = isset($doc['location_id']) ? (int)$doc['location_id'] : null;

        if (!self::isEnabled($type)) return ['status' => 'Approved', 'request_id' => null, 'level' => null];
        $levels = self::levelsFor($type, $amount, $loc);
        if (!$levels) return ['status' => 'Approved', 'request_id' => null, 'level' => null];

        // doc_id 0 = document created only after approval (stock adjustments): never "already pending".
        $existing = $docId > 0 ? self::forDocument($type, $docId) : null;
        if ($existing && $existing->status === 'Pending') {
            return ['status' => 'Pending', 'request_id' => (int)$existing->id, 'level' => self::levelLabel($levels[0])];
        }

        $first = $levels[0];
        $db = self::db();
        $db->query("INSERT INTO approval_requests (doc_type, doc_id, doc_no, summary, payload, amount, location_id, requested_by, status, current_level)
                    VALUES (:t, :d, :no, :s, :p, :a, :l, :u, 'Pending', :lv)");
        $db->bind(':p', isset($doc['payload']) ? json_encode($doc['payload']) : null);
        $db->bind(':t', $type); $db->bind(':d', $docId);
        $db->bind(':no', $doc['doc_no'] ?? null); $db->bind(':s', mb_substr((string)($doc['summary'] ?? ''), 0, 255));
        $db->bind(':a', $amount); $db->bind(':l', $loc); $db->bind(':u', $userId); $db->bind(':lv', (int)$first->level_no);
        $db->execute();
        $reqId = (int)$db->lastInsertId();
        self::log($reqId, null, $userId, 'Submitted', null);
        self::notify($reqId, $first);
        return ['status' => 'Pending', 'request_id' => $reqId, 'level' => self::levelLabel($first)];
    }

    /** Approve or reject. Returns the updated request. Throws on not-allowed / bad state. */
    public static function act(int $requestId, array $user, string $decision, ?string $comment = null) {
        $req = self::get($requestId);
        if (!$req) throw new RuntimeException('Approval request not found.');
        if ($req->status !== 'Pending') throw new RuntimeException('This request is already ' . strtolower($req->status) . '.');
        $levels = self::levelsFor($req->doc_type, $req->amount !== null ? (float)$req->amount : null, $req->location_id !== null ? (int)$req->location_id : null);
        $current = null;
        foreach ($levels as $l) if ((int)$l->level_no === (int)$req->current_level) { $current = $l; break; }
        if (!$current) $current = $levels[0] ?? null; // levels changed since submit: use the first one that applies
        if (!$current) throw new RuntimeException('No approval level applies any more; ask an administrator to check the rules.');
        if (!self::canAct($current, $user)) throw new RuntimeException('You are not an approver for this level.');
        if ((int)$req->requested_by === (int)$user['sub'] && !self::isAdmin($user)) {
            throw new RuntimeException('You can\'t approve your own request.');
        }

        $uid = (int)$user['sub'];
        $db = self::db();
        if ($decision === 'reject') {
            if (trim((string)$comment) === '') throw new RuntimeException('Give a reason for rejecting.');
            self::setStatus($requestId, 'Rejected', null);
            self::log($requestId, (int)$current->level_no, $uid, 'Rejected', $comment);
            ApprovalHandlers::onRejected($req, $uid, (string)$comment);
            self::notifyRequester($req, "rejected: " . $comment);
            return self::get($requestId);
        }

        $next = null;
        foreach ($levels as $l) if ((int)$l->level_no > (int)$current->level_no) { $next = $l; break; }
        if ($next) {
            self::log($requestId, (int)$current->level_no, $uid, 'Approved', $comment);
            self::setStatus($requestId, 'Pending', (int)$next->level_no);
            self::notify($requestId, $next);
        } else {
            // Do the document's action first; if it fails (RuntimeException) nothing is marked approved.
            ApprovalHandlers::onApproved($req, $uid);
            self::log($requestId, (int)$current->level_no, $uid, 'Approved', $comment);
            self::setStatus($requestId, 'Approved', null);
            self::notifyRequester($req, 'approved');
        }
        return self::get($requestId);
    }

    /** The requester withdraws a pending request (e.g. to edit the document). */
    public static function withdraw(int $requestId, array $user): void {
        $req = self::get($requestId);
        if (!$req || $req->status !== 'Pending') throw new RuntimeException('Only pending requests can be withdrawn.');
        if ((int)$req->requested_by !== (int)$user['sub'] && !self::isAdmin($user)) throw new RuntimeException('Only the person who sent it can withdraw it.');
        self::setStatus($requestId, 'Withdrawn', null);
        self::log($requestId, null, (int)$user['sub'], 'Withdrawn', null);
        // Back to editable, like a rejection but without a reason.
        ApprovalHandlers::onRejected($req, (int)$user['sub'], 'Withdrawn by requester');
    }

    /** Pending requests the user can act on now. */
    public static function inbox(array $user): array {
        $db = self::db();
        $db->query("SELECT r.*, u.name AS requested_by_name FROM approval_requests r
                    LEFT JOIN users u ON u.id = r.requested_by
                    WHERE r.status = 'Pending' ORDER BY r.created_at ASC");
        $out = [];
        foreach ($db->resultSet() ?: [] as $r) {
            $levels = self::levelsFor($r->doc_type, $r->amount !== null ? (float)$r->amount : null, $r->location_id !== null ? (int)$r->location_id : null);
            foreach ($levels as $l) {
                if ((int)$l->level_no !== (int)$r->current_level) continue;
                if (!self::canAct($l, $user)) break;
                if ((int)$r->requested_by === (int)$user['sub'] && !self::isAdmin($user)) break;
                $out[] = self::present($r, $l, count($levels));
                break;
            }
        }
        return $out;
    }

    public static function inboxCount(array $user): int { return count(self::inbox($user)); }

    /** Requests the user sent, newest first. */
    public static function mine(array $user, int $limit = 50): array {
        $db = self::db();
        $db->query("SELECT r.*, u.name AS requested_by_name FROM approval_requests r LEFT JOIN users u ON u.id = r.requested_by
                    WHERE r.requested_by = :u ORDER BY r.id DESC LIMIT " . (int)$limit);
        $db->bind(':u', (int)$user['sub']);
        return array_map(fn($r) => self::present($r, null, null), $db->resultSet() ?: []);
    }

    public static function history(int $requestId): array {
        $db = self::db();
        $db->query("SELECT a.*, u.name AS user_name FROM approval_actions a LEFT JOIN users u ON u.id = a.user_id
                    WHERE a.request_id = :r ORDER BY a.id");
        $db->bind(':r', $requestId);
        return $db->resultSet() ?: [];
    }

    // ---------- internals ----------

    public static function get(int $id) {
        $db = self::db();
        $db->query("SELECT r.*, u.name AS requested_by_name FROM approval_requests r LEFT JOIN users u ON u.id = r.requested_by WHERE r.id = :id");
        $db->bind(':id', $id);
        return $db->single() ?: null;
    }

    private static function isAdmin(array $u): bool { return strtolower((string)($u['role'] ?? '')) === 'admin'; }

    private static function canAct($level, array $user): bool {
        if (self::isAdmin($user)) return true;
        if ($level->approver_type === 'user') return (int)$level->user_id === (int)$user['sub'];
        return (int)$level->role_id > 0 && (int)$level->role_id === (int)($user['role_id'] ?? 0);
    }

    public static function levelLabel($l): string {
        if (!empty($l->label)) return $l->label;
        $db = self::db();
        if ($l->approver_type === 'user') { $db->query("SELECT name FROM users WHERE id = :i"); $db->bind(':i', (int)$l->user_id); }
        else { $db->query("SELECT name FROM roles WHERE id = :i"); $db->bind(':i', (int)$l->role_id); }
        return 'Level ' . $l->level_no . ': ' . ($db->singleColumn() ?: 'unassigned');
    }

    private static function present($r, $level, $levelCount): array {
        $t = self::TYPES[$r->doc_type] ?? ['label' => $r->doc_type, 'href' => '#'];
        return [
            'id' => (int)$r->id, 'doc_type' => $r->doc_type, 'doc_type_label' => $t['label'],
            'doc_id' => (int)$r->doc_id, 'doc_no' => $r->doc_no, 'summary' => $r->summary,
            'amount' => $r->amount !== null ? (float)$r->amount : null, 'status' => $r->status,
            'current_level' => $r->current_level !== null ? (int)$r->current_level : null,
            'level_label' => $level ? self::levelLabel($level) : null, 'level_count' => $levelCount,
            'requested_by' => $r->requested_by_name, 'created_at' => $r->created_at,
            'href' => (int)$r->doc_id > 0 ? sprintf($t['href'], (int)$r->doc_id) : null,
        ];
    }

    private static function setStatus(int $id, string $status, ?int $level): void {
        $db = self::db();
        $db->query("UPDATE approval_requests SET status = :s, current_level = :l WHERE id = :id");
        $db->bind(':s', $status); $db->bind(':l', $level); $db->bind(':id', $id);
        $db->execute();
    }

    private static function log(int $reqId, ?int $level, ?int $userId, string $action, ?string $comment): void {
        $db = self::db();
        $db->query("INSERT INTO approval_actions (request_id, level_no, user_id, action, comment) VALUES (:r, :l, :u, :a, :c)");
        $db->bind(':r', $reqId); $db->bind(':l', $level); $db->bind(':u', $userId); $db->bind(':a', $action);
        $db->bind(':c', $comment !== null ? mb_substr($comment, 0, 500) : null);
        $db->execute();
    }

    /** Email / SMS the approvers of a level (in-app inbox needs nothing extra). Never throws. */
    private static function notify(int $reqId, $level): void {
        try {
            $req = self::get($reqId);
            $db = self::db();
            $db->query("SELECT notify_email, notify_sms FROM approval_doc_types WHERE doc_type = :t");
            $db->bind(':t', $req->doc_type);
            $cfg = $db->single();
            if (!$cfg || (!(int)$cfg->notify_email && !(int)$cfg->notify_sms)) return;

            if ($level->approver_type === 'user') {
                $db->query("SELECT name, email, phone FROM users WHERE id = :i AND is_active = 1");
                $db->bind(':i', (int)$level->user_id);
            } else {
                $db->query("SELECT name, email, phone FROM users WHERE role_id = :i AND is_active = 1");
                $db->bind(':i', (int)$level->role_id);
            }
            $people = $db->resultSet() ?: [];
            $label = self::TYPES[$req->doc_type]['label'] ?? $req->doc_type;
            $amount = $req->amount !== null ? ' (LKR ' . number_format((float)$req->amount, 2) . ')' : '';
            $line = "Approval needed: " . rtrim(preg_replace('/s$/', '', $label)) . ' ' . ($req->doc_no ?: '#' . $req->doc_id) . $amount
                  . ' from ' . ($req->requested_by_name ?: 'a user') . '.';

            foreach ($people as $p) {
                if ((int)$cfg->notify_email && !empty($p->email)) {
                    require_once __DIR__ . '/EmailHelper.php';
                    @EmailHelper::send($p->email, $line,
                        "<p>Hi " . htmlspecialchars($p->name) . ",</p><p>" . htmlspecialchars($line) . "</p>"
                        . "<p>" . htmlspecialchars((string)$req->summary) . "</p><p>Open BizzFlow → Approvals & Control → My Approvals to approve or reject.</p>");
                }
                if ((int)$cfg->notify_sms && !empty($p->phone)) {
                    require_once __DIR__ . '/SmsHelper.php';
                    @SmsHelper::send($p->phone, mb_substr($line . ' Open BizzFlow > My Approvals.', 0, 300));
                }
            }
        } catch (Throwable $e) {
            error_log('Approval notify failed: ' . $e->getMessage());
        }
    }

    private static function notifyRequester($req, string $what): void {
        try {
            $db = self::db();
            $db->query("SELECT notify_email FROM approval_doc_types WHERE doc_type = :t");
            $db->bind(':t', $req->doc_type);
            if (!(int)($db->singleColumn() ?: 0)) return;
            $db->query("SELECT name, email FROM users WHERE id = :i");
            $db->bind(':i', (int)$req->requested_by);
            $p = $db->single();
            if (!$p || empty($p->email)) return;
            require_once __DIR__ . '/EmailHelper.php';
            $doc = ($req->doc_no ?: '#' . $req->doc_id);
            @EmailHelper::send($p->email, "Your request $doc was $what", "<p>Hi " . htmlspecialchars($p->name) . ",</p><p>Your approval request for $doc was " . htmlspecialchars($what) . ".</p>");
        } catch (Throwable $e) {
            error_log('Approval requester notify failed: ' . $e->getMessage());
        }
    }
}

/**
 * What happens to each document type when its approval finishes. Each handler is idempotent
 * (safe if called twice) and throws RuntimeException with a readable message when the
 * document can't be completed, so the request stays pending.
 */
class ApprovalHandlers {
    public static function onApproved($req, int $userId): void {
        $db = new Database();
        $id = (int)$req->doc_id;
        switch ($req->doc_type) {
            case 'purchase_order':
                $db->query("UPDATE purchase_orders SET status = 'Approved', updated_by = :u WHERE id = :id AND status IN ('Pending Approval','Draft')");
                $db->bind(':u', $userId); $db->bind(':id', $id); $db->execute();
                break;

            case 'expense':
                $db->query("SELECT * FROM acc_expenses WHERE id = :id");
                $db->bind(':id', $id);
                $e = $db->single();
                if (!$e) throw new RuntimeException('Expense voucher not found.');
                if ($e->status !== 'Pending') return;
                // Post first; only a voucher that reached the books is marked Paid.
                require_once __DIR__ . '/AccountingSchema.php';
                require_once __DIR__ . '/AccountingHelper.php';
                $posted = AccountingHelper::postExpenseVoucher($id, (array)$e + ['userId' => (int)$e->created_by]);
                if ($posted === false) throw new RuntimeException('The voucher could not be posted to the accounts (check account mappings or closed periods).');
                $db->query("UPDATE acc_expenses SET status = 'Paid' WHERE id = :id AND status = 'Pending'");
                $db->bind(':id', $id); $db->execute();
                break;

            case 'stock_count':
                require_once __DIR__ . '/../models/StockCount.php';
                $res = (new StockCount())->approve($id, $userId);
                if (is_array($res) && isset($res['error'])) {
                    if (stripos($res['error'], 'already Approved') !== false) return;
                    throw new RuntimeException('Stock count: ' . $res['error']);
                }
                if (!$res) throw new RuntimeException('Stock count could not be applied.');
                break;

            case 'stock_requisition':
                $db->query("UPDATE stock_transfer_requisitions SET status = 'Approved', approved_by = :u, approved_at = NOW() WHERE id = :id AND status = 'Pending Approval'");
                $db->bind(':u', $userId); $db->bind(':id', $id); $db->execute();
                break;

            case 'stock_adjustment':
                // The adjustment is created now, from the details saved when it was requested.
                if ($id > 0) return; // already created
                $p = json_decode((string)($req->payload ?? ''), true);
                if (!is_array($p) || empty($p['data'])) throw new RuntimeException('The adjustment details are missing.');
                require_once __DIR__ . '/../models/StockAdjustment.php';
                $res = (new StockAdjustment())->create($p['data'], (int)($p['user_id'] ?? $userId), (int)($p['location_id'] ?? 1));
                if (is_array($res) && isset($res['error'])) throw new RuntimeException($res['error']);
                if (!$res) throw new RuntimeException('Stock adjustment could not be applied (no lines changed?).');
                $db->query("UPDATE approval_requests SET doc_id = :d WHERE id = :r");
                $db->bind(':d', (int)$res); $db->bind(':r', (int)$req->id); $db->execute();
                break;

            case 'cancellation':
                require_once __DIR__ . '/CancellationRequestHelper.php';
                $db->query("SELECT * FROM cancellation_requests WHERE id = :id");
                $db->bind(':id', $id);
                $r = $db->single();
                if (!$r) throw new RuntimeException('Cancellation request not found.');
                if ($r->status !== 'pending') return;
                $block = CancellationRequestHelper::blocker($db, $r->doc_type, (int)$r->doc_id);
                if ($block) throw new RuntimeException($block);
                [$ok, $msg] = CancellationRequestHelper::execute($r->doc_type, (int)$r->doc_id, $r->reason . ' (approved by user #' . $userId . ')', $userId);
                if (!$ok) throw new RuntimeException($msg);
                $db->query("UPDATE cancellation_requests SET status = 'approved', decided_by = :u, decided_at = NOW() WHERE id = :id AND status = 'pending'");
                $db->bind(':u', $userId); $db->bind(':id', $id); $db->execute();
                break;
        }
    }

    public static function onRejected($req, int $userId, string $reason): void {
        $db = new Database();
        $id = (int)$req->doc_id;
        switch ($req->doc_type) {
            case 'purchase_order':
                $db->query("UPDATE purchase_orders SET status = 'Draft' WHERE id = :id AND status = 'Pending Approval'");
                $db->bind(':id', $id); $db->execute();
                break;

            case 'expense':
                // Never posted, so nothing to reverse; the voucher is simply cancelled.
                $db->query("UPDATE acc_expenses SET status = 'Cancelled', cancelled_at = NOW(), cancelled_by = :u, cancellation_reason = :r WHERE id = :id AND status = 'Pending'");
                $db->bind(':u', $userId); $db->bind(':r', 'Not approved: ' . $reason); $db->bind(':id', $id); $db->execute();
                break;

            case 'stock_count':
                require_once __DIR__ . '/../models/StockCount.php';
                (new StockCount())->reject($id, $userId);
                break;

            case 'stock_adjustment':
                break; // nothing was applied

            case 'stock_requisition':
                $db->query("UPDATE stock_transfer_requisitions SET status = 'Rejected', notes = CONCAT(COALESCE(notes, ''), :r) WHERE id = :id AND status = 'Pending Approval'");
                $db->bind(':r', "\nNot approved: " . mb_substr($reason, 0, 400)); $db->bind(':id', $id); $db->execute();
                break;

            case 'cancellation':
                $db->query("UPDATE cancellation_requests SET status = 'rejected', decided_by = :u, decided_at = NOW(), decision_note = :n WHERE id = :id AND status = 'pending'");
                $db->bind(':u', $userId); $db->bind(':n', mb_substr($reason, 0, 500)); $db->bind(':id', $id); $db->execute();
                break;
        }
    }
}
