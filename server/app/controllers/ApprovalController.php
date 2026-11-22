<?php
/**
 * Approval workflow API (engine: helpers/Approval.php).
 *   GET  /api/approval/rules              types (on/off, notifications), their levels, roles and users to pick from
 *   POST /api/approval/save_rules         { doc_type, enabled, notify_email, notify_sms, levels: [...] }  (admin)
 *   GET  /api/approval/inbox              requests waiting for the signed-in user
 *   GET  /api/approval/count              { count } for the header bell
 *   GET  /api/approval/mine               requests the user sent
 *   GET  /api/approval/history/{id}       request + its actions
 *   POST /api/approval/act/{id}           { decision: approve|reject, comment }
 *   POST /api/approval/withdraw/{id}
 */
require_once '../app/helpers/Approval.php';

class ApprovalController extends Controller {

    public function rules() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) $this->error('Only administrators can view approval rules.', 403);
        ApprovalSchema::ensure();
        $db = new Database();
        $db->query("SELECT * FROM approval_doc_types");
        $cfg = [];
        foreach ($db->resultSet() ?: [] as $r) $cfg[$r->doc_type] = $r;
        $db->query("SELECT * FROM approval_levels ORDER BY doc_type, level_no, id");
        $levels = [];
        foreach ($db->resultSet() ?: [] as $l) $levels[$l->doc_type][] = [
            'level_no' => (int)$l->level_no, 'label' => $l->label, 'approver_type' => $l->approver_type,
            'role_id' => $l->role_id !== null ? (int)$l->role_id : null, 'user_id' => $l->user_id !== null ? (int)$l->user_id : null,
            'min_amount' => $l->min_amount !== null ? (float)$l->min_amount : null,
            'location_id' => $l->location_id !== null ? (int)$l->location_id : null,
        ];
        $types = [];
        foreach (Approval::TYPES as $key => $t) {
            $c = $cfg[$key] ?? null;
            $types[] = [
                'doc_type' => $key, 'label' => $t['label'],
                'enabled' => $c ? (bool)(int)$c->enabled : false,
                'notify_email' => $c ? (bool)(int)$c->notify_email : true,
                'notify_sms' => $c ? (bool)(int)$c->notify_sms : false,
                'levels' => $levels[$key] ?? [],
            ];
        }
        $db->query("SELECT id, name FROM roles ORDER BY name");
        $roles = $db->resultSet() ?: [];
        $db->query("SELECT u.id, u.name, u.email, u.phone, r.name AS role FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.is_active = 1 ORDER BY u.name");
        $users = $db->resultSet() ?: [];
        $db->query("SELECT id, name FROM service_locations ORDER BY name");
        $locations = $db->resultSet() ?: [];
        $this->success(['types' => $types, 'roles' => $roles, 'users' => $users, 'locations' => $locations]);
    }

    public function save_rules() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) $this->error('Only administrators can change approval rules.', 403);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method not allowed', 405);
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $type = (string)($in['doc_type'] ?? '');
        if (!isset(Approval::TYPES[$type])) $this->error('Unknown document type', 422);

        $levels = is_array($in['levels'] ?? null) ? array_values($in['levels']) : [];
        $enabled = !empty($in['enabled']);
        if ($enabled && !$levels) $this->error('Add at least one approval level before switching approval on.', 422);
        foreach ($levels as $i => $l) {
            $t = ($l['approver_type'] ?? 'role') === 'user' ? 'user' : 'role';
            if ($t === 'role' && empty($l['role_id'])) $this->error('Level ' . ($i + 1) . ': choose a role.', 422);
            if ($t === 'user' && empty($l['user_id'])) $this->error('Level ' . ($i + 1) . ': choose a person.', 422);
            if (isset($l['min_amount']) && $l['min_amount'] !== '' && $l['min_amount'] !== null && (float)$l['min_amount'] < 0) {
                $this->error('Level ' . ($i + 1) . ': minimum amount can\'t be negative.', 422);
            }
        }

        ApprovalSchema::ensure();
        $db = new Database();
        $db->beginTransaction();
        try {
            $db->query("INSERT INTO approval_doc_types (doc_type, enabled, notify_email, notify_sms, updated_by) VALUES (:t, :e, :m, :s, :u)
                        ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), notify_email = VALUES(notify_email), notify_sms = VALUES(notify_sms), updated_by = VALUES(updated_by)");
            $db->bind(':t', $type); $db->bind(':e', $enabled ? 1 : 0);
            $db->bind(':m', !empty($in['notify_email']) ? 1 : 0); $db->bind(':s', !empty($in['notify_sms']) ? 1 : 0);
            $db->bind(':u', (int)$u['sub']);
            $db->execute();

            $db->query("DELETE FROM approval_levels WHERE doc_type = :t");
            $db->bind(':t', $type);
            $db->execute();
            foreach ($levels as $i => $l) {
                $t = ($l['approver_type'] ?? 'role') === 'user' ? 'user' : 'role';
                $db->query("INSERT INTO approval_levels (doc_type, level_no, label, approver_type, role_id, user_id, min_amount, location_id)
                            VALUES (:t, :n, :lb, :at, :r, :us, :m, :loc)");
                $db->bind(':t', $type); $db->bind(':n', $i + 1);
                $db->bind(':lb', trim((string)($l['label'] ?? '')) ?: null);
                $db->bind(':at', $t);
                $db->bind(':r', $t === 'role' ? (int)$l['role_id'] : null);
                $db->bind(':us', $t === 'user' ? (int)$l['user_id'] : null);
                $db->bind(':m', (isset($l['min_amount']) && $l['min_amount'] !== '' && $l['min_amount'] !== null) ? (float)$l['min_amount'] : null);
                $db->bind(':loc', !empty($l['location_id']) ? (int)$l['location_id'] : null);
                $db->execute();
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollBack();
            $this->error('Could not save: ' . $e->getMessage(), 500);
        }
        $this->success(null, 'Approval rules saved');
    }

    public function inbox() {
        $u = $this->requireAuth();
        $this->success(Approval::inbox($u));
    }

    public function count() {
        $u = $this->requireAuth();
        $this->success(['count' => Approval::inboxCount($u)]);
    }

    public function mine() {
        $u = $this->requireAuth();
        $this->success(Approval::mine($u));
    }

    public function history($id = null) {
        $u = $this->requireAuth();
        $req = Approval::get((int)$id);
        if (!$req) $this->error('Not found', 404);
        $this->success(['request' => $req, 'actions' => Approval::history((int)$id)]);
    }

    public function act($id = null) {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method not allowed', 405);
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $decision = ($in['decision'] ?? '') === 'reject' ? 'reject' : 'approve';
        try {
            $r = Approval::act((int)$id, $u, $decision, isset($in['comment']) ? (string)$in['comment'] : null);
            $this->success($r, $decision === 'reject' ? 'Rejected' : ($r->status === 'Approved' ? 'Approved' : 'Approved; sent to the next level'));
        } catch (RuntimeException $e) {
            $this->error($e->getMessage(), 409);
        }
    }

    public function withdraw($id = null) {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method not allowed', 405);
        try {
            Approval::withdraw((int)$id, $u);
            $this->success(null, 'Withdrawn');
        } catch (RuntimeException $e) {
            $this->error($e->getMessage(), 409);
        }
    }
}
