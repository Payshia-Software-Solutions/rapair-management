<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Database;
use App\Core\Mailer;
use App\Models\AdminModel;
use App\Services\ProvisioningService;

/**
 * A client changes their workspace address (the part before the domain).
 * Two steps, both needed: password + a 6-digit code emailed to the account address.
 */
class WorkspaceController extends Controller {
    private const COOLDOWN_DAYS = 30;
    private const OTP_MINUTES = 10;
    private const OTP_MAX_ATTEMPTS = 5;
    private const PURPOSE = 'workspace_address';
    private const RESERVED = ['www', 'api', 'admin', 'app', 'mail', 'static', 'login', 'nexus', 'order', 'portal', 'status', 'cdn', 'staging'];

    private function requireClient() {
        if (!isset($_SESSION['admin_id'], $_SESSION['tenant_id'])) {
            $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }
        $db = new Database();
        $db->query("SELECT * FROM saas_tenants WHERE id = :id");
        $db->bind(':id', (int)$_SESSION['tenant_id']);
        $tenant = $db->single();
        if (!$tenant) $this->json(['status' => 'error', 'message' => 'Account not found'], 404);
        return [$db, $tenant];
    }

    // GET /api/client/workspace/progress  Polled by the setup progress screen.
    // Technical error text stays out of the client's view (admins see it in Nexus admin).
    public function progress() {
        [, $tenant] = $this->requireClient();
        $svc = new ProvisioningService();
        try {
            $p = $svc->progress((int)$tenant->id);
        } catch (\Throwable $e) {
            return $this->json(['status' => 'error', 'message' => 'Could not load the setup status.'], 500);
        }
        if ($p['event']) {
            $p['event']['had_error'] = !empty($p['event']['last_error']);
            unset($p['event']['last_error']);
        }
        $p['provision_error'] = $p['provision_error'] ? 'Setup hit a problem.' : null;
        if ($p['erp']) unset($p['erp']['last_error']);
        unset($p['erp_error']);
        self::replyThenDeliver($svc, (int)$tenant->id, $p);
    }

    /** Sends the JSON reply, then (setup waiting to be sent) delivers it, so no cron is needed. */
    public static function replyThenDeliver(ProvisioningService $svc, int $tenantId, array $data) {
        $due = ($data['provision_status'] ?? '') === 'pending' && $svc->setupDue($tenantId);
        $body = json_encode(['status' => 'success', 'data' => $data]);
        header('Content-Type: application/json');
        if (!$due) { echo $body; exit; }
        ignore_user_abort(true);
        set_time_limit(400);
        session_write_close(); // the browser's next poll must not wait on this session
        // Headers first (body length known), so the browser gets its answer before delivery starts
        header('Connection: close');
        header('Content-Length: ' . strlen($body));
        echo $body;
        while (ob_get_level() > 0) @ob_end_flush();
        flush();
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
        try { $svc->deliverDue(5); } catch (\Throwable $e) { error_log('Delivery after progress poll: ' . $e->getMessage()); }
        exit;
    }

    // POST /api/client/workspace/retry-setup
    // Client retries a workspace setup that failed. Queues a fresh tenant.created event and delivers it now.
    public function retrySetup() {
        [$db, $tenant] = $this->requireClient();
        if (($tenant->provision_status ?? '') !== 'failed') {
            return $this->json(['status' => 'error', 'message' => 'Your workspace setup is not in a failed state.'], 409);
        }
        if (($tenant->status ?? '') === 'Deleted') {
            return $this->json(['status' => 'error', 'message' => 'This account is closed.'], 409);
        }
        set_time_limit(400);
        try {
            (new ProvisioningService())->provision((int)$tenant->id, true);
        } catch (\Throwable $e) {
            error_log('Workspace retry failed: ' . $e->getMessage());
            return $this->json(['status' => 'error', 'message' => 'Could not restart the setup. Please try again in a few minutes.'], 500);
        }
        $db->query("SELECT provision_status, provision_error FROM saas_tenants WHERE id = :id");
        $db->bind(':id', (int)$tenant->id);
        $row = $db->single();
        return $this->json(['status' => 'success', 'data' => [
            'provision_status' => $row->provision_status ?? 'pending',
            'provision_error' => $row->provision_error ?? null,
        ]]);
    }

    // POST /api/client/workspace/address/request {label, password}
    public function requestAddressChange() {
        [$db, $tenant] = $this->requireClient();
        $data = $this->getPostData() ?: [];
        $label = strtolower(trim((string)($data['label'] ?? '')));
        $password = (string)($data['password'] ?? '');

        if (($tenant->provision_status ?? '') !== 'ready' || empty($tenant->workspace_url)) {
            return $this->json(['status' => 'error', 'message' => 'Your workspace is not ready yet.'], 409);
        }
        if (($tenant->status ?? '') === 'Suspended') {
            return $this->json(['status' => 'error', 'message' => 'The address cannot be changed while the account is suspended.'], 409);
        }
        if ($tenant->address_changed_at && strtotime($tenant->address_changed_at) > strtotime('-' . self::COOLDOWN_DAYS . ' days')) {
            $next = date('M j, Y', strtotime($tenant->address_changed_at . ' +' . self::COOLDOWN_DAYS . ' days'));
            return $this->json(['status' => 'error', 'message' => "The address can be changed once every " . self::COOLDOWN_DAYS . " days. Try again after $next."], 429);
        }

        $error = $this->validateLabel($db, $tenant, $label);
        if ($error) return $this->json(['status' => 'error', 'message' => $error], 400);

        // Identity check 1: the account password
        $admin = (new AdminModel())->findByUsername($_SESSION['admin_user'] ?? '');
        if (!$admin || !password_verify($password, $admin->password)) {
            return $this->json(['status' => 'error', 'message' => 'Your password is not correct.'], 403);
        }

        // At most one code a minute
        $db->query("SELECT created_at FROM saas_identity_otps WHERE admin_id = :a AND purpose = :p ORDER BY id DESC LIMIT 1");
        $db->bind(':a', (int)$admin->id);
        $db->bind(':p', self::PURPOSE);
        $last = $db->single();
        if ($last && strtotime($last->created_at) > time() - 60) {
            return $this->json(['status' => 'error', 'message' => 'A code was just sent. Wait a minute before asking for another.'], 429);
        }

        // Identity check 2: a one-time code to the account email
        $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $db->query("UPDATE saas_identity_otps SET used_at = NOW() WHERE admin_id = :a AND purpose = :p AND used_at IS NULL");
        $db->bind(':a', (int)$admin->id);
        $db->bind(':p', self::PURPOSE);
        $db->execute();
        $db->query("INSERT INTO saas_identity_otps (admin_id, purpose, code_hash, payload, expires_at)
                    VALUES (:a, :p, :h, :pl, NOW() + INTERVAL " . self::OTP_MINUTES . " MINUTE)");
        $db->bind(':a', (int)$admin->id);
        $db->bind(':p', self::PURPOSE);
        $db->bind(':h', password_hash($code, PASSWORD_DEFAULT));
        $db->bind(':pl', $label);
        $db->execute();

        $body = "<h2 style='margin:0 0 12px'>Confirm your new workspace address</h2>"
            . "<p>Your confirmation code is:</p>"
            . "<p style='font-size:28px;font-weight:700;letter-spacing:6px;margin:12px 0'>$code</p>"
            . "<p>It expires in " . self::OTP_MINUTES . " minutes. If you did not ask for this, ignore this email and consider changing your password.</p>";
        $sent = false;
        try { $sent = Mailer::sendCustomEmail($admin->username, $admin->full_name ?: $admin->username, 'Your BizzFlow confirmation code', $body); }
        catch (\Throwable $e) { error_log('Address OTP mail: ' . $e->getMessage()); }
        if (!$sent) {
            return $this->json(['status' => 'error', 'message' => 'We could not send the confirmation email. Try again shortly.'], 502);
        }
        return $this->json(['status' => 'success', 'message' => 'We emailed a 6-digit code to ' . $admin->username . '.']);
    }

    // POST /api/client/workspace/address/confirm {code}
    public function confirmAddressChange() {
        [$db, $tenant] = $this->requireClient();
        $data = $this->getPostData() ?: [];
        $code = preg_replace('/\D/', '', (string)($data['code'] ?? ''));

        $db->query("SELECT * FROM saas_identity_otps WHERE admin_id = :a AND purpose = :p AND used_at IS NULL ORDER BY id DESC LIMIT 1");
        $db->bind(':a', (int)$_SESSION['admin_id']);
        $db->bind(':p', self::PURPOSE);
        $otp = $db->single();
        if (!$otp || strtotime($otp->expires_at) < time()) {
            return $this->json(['status' => 'error', 'message' => 'That code has expired. Start again to get a new one.'], 400);
        }
        if ((int)$otp->attempts >= self::OTP_MAX_ATTEMPTS) {
            return $this->json(['status' => 'error', 'message' => 'Too many wrong codes. Start again to get a new one.'], 429);
        }
        if (!password_verify($code, $otp->code_hash)) {
            $db->query("UPDATE saas_identity_otps SET attempts = attempts + 1 WHERE id = :id");
            $db->bind(':id', (int)$otp->id);
            $db->execute();
            return $this->json(['status' => 'error', 'message' => 'That code is not correct.'], 400);
        }

        // Single use, and the label is checked again: someone else may have taken it meanwhile
        $db->query("UPDATE saas_identity_otps SET used_at = NOW() WHERE id = :id AND used_at IS NULL");
        $db->bind(':id', (int)$otp->id);
        $db->execute();
        if ($db->rowCount() !== 1) {
            return $this->json(['status' => 'error', 'message' => 'That code was already used.'], 400);
        }
        $label = $otp->payload;
        $error = $this->validateLabel($db, $tenant, $label);
        if ($error) return $this->json(['status' => 'error', 'message' => $error], 409);

        $oldUrl = $tenant->workspace_url;
        try {
            $newUrl = (new ProvisioningService())->changeAddress((int)$tenant->id, $label);
        } catch (\Throwable $e) {
            error_log('Workspace address change failed: ' . $e->getMessage());
            return $this->json(['status' => 'error', 'message' => 'The workspace server could not apply the change. Your address is unchanged. Please try again or contact support.'], 502);
        }

        $db->query("UPDATE saas_tenants SET workspace_url = :u, address_changed_at = NOW() WHERE id = :id");
        $db->bind(':u', $newUrl);
        $db->bind(':id', (int)$tenant->id);
        $db->execute();

        // Tell the account owner (and anyone who might not have done this)
        try {
            $admin = (new AdminModel())->findByUsername($_SESSION['admin_user'] ?? '');
            if ($admin) {
                $body = "<h2 style='margin:0 0 12px'>Your workspace address changed</h2>"
                    . "<p>Your workspace is now at <a href='" . htmlspecialchars($newUrl) . "'>" . htmlspecialchars($newUrl) . "</a>.</p>"
                    . "<p>The previous address (" . htmlspecialchars((string)$oldUrl) . ") no longer works. Update your bookmarks. "
                    . "If you did not make this change, contact support immediately.</p>";
                Mailer::sendCustomEmail($admin->username, $admin->full_name ?: $admin->username, 'Your BizzFlow workspace address changed', $body);
            }
        } catch (\Throwable $e) { error_log('Address change notice: ' . $e->getMessage()); }

        return $this->json(['status' => 'success', 'message' => 'Your workspace address was changed.', 'workspace_url' => $newUrl]);
    }

    /** Null when the label can be used, otherwise the reason. */
    private function validateLabel(Database $db, $tenant, string $label): ?string {
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/', $label)) {
            return 'Use 3 to 42 letters, numbers or dashes. It must start and end with a letter or number.';
        }
        if (in_array($label, self::RESERVED, true)) return 'That address is reserved. Choose another.';
        $current = explode('.', (string)parse_url((string)$tenant->workspace_url, PHP_URL_HOST))[0] ?? '';
        if ($label === $current) return 'That is already your address.';

        // Not used by another workspace: neither as its internal name nor as the front of its address
        $db->query("SELECT id FROM saas_tenants WHERE id <> :id AND status <> 'Deleted'
                    AND (slug = :l OR workspace_url REGEXP :re) LIMIT 1");
        $db->bind(':id', (int)$tenant->id);
        $db->bind(':l', $label);
        $db->bind(':re', '^[a-z]+://' . preg_quote($label, '/') . '[.:/]');
        if ($db->single()) return 'That address is taken. Choose another.';
        return null;
    }
}
