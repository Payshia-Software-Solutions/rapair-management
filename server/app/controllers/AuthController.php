<?php
/**
 * Auth Controller (JWT)
 */
class AuthController extends Controller {
    private $userModel;
    private $auditModel;

    public function __construct() {
        $this->userModel = $this->model('User');
        $this->auditModel = $this->model('AuditLog');
    }

    // POST /api/auth/login
    public function login() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        if ($email === '' || $password === '') {
            $this->error('Email and password are required', 400);
            return;
        }

        $user = $this->userModel->getByEmail($email);
        $ok = $user && isset($user->password_hash) && password_verify($password, $user->password_hash);

        $this->auditModel->write([
            'user_id' => $ok ? (int)$user->id : null,
            'action' => $ok ? 'login_success' : 'login_failed',
            'entity' => 'user',
            'entity_id' => $ok ? (int)$user->id : null,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['email' => $email]),
        ]);

        if (!$ok) {
            $this->error('Invalid credentials', 401);
            return;
        }

        // Block login for inactive accounts.
        $isActive = true;
        if (isset($user->is_active)) {
            $isActive = ((int)$user->is_active) === 1;
        }
        if (!$isActive) {
            $this->auditModel->write([
                'user_id' => (int)$user->id,
                'action' => 'login_blocked_inactive',
                'entity' => 'user',
                'entity_id' => (int)$user->id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['email' => $email]),
            ]);
            $this->error('Your account is not active yet. Please contact an administrator to activate your account.', 403);
            return;
        }

        $now = time();

        // Keep the Nexus portal's usage numbers current (once an hour at most).
        try { require_once __DIR__ . '/../helpers/SaasHelper.php'; SaasHelper::reportUsageThrottled(); } catch (Throwable $e) {}

        // Allowed locations for this user (supports multi-location assignment).
        $allowedLocationIds = [];
        $allowedLocations = [];
        try {
            $db = new Database();
            $db->query("
                SELECT ul.location_id, sl.name
                FROM user_locations ul
                INNER JOIN service_locations sl ON sl.id = ul.location_id
                WHERE ul.user_id = :uid
                ORDER BY ul.location_id ASC
            ");
            $db->bind(':uid', (int)$user->id);
            $locRows = $db->resultSet() ?: [];
            foreach ($locRows as $r) {
                $allowedLocationIds[] = (int)$r->location_id;
                $allowedLocations[] = ['id' => (int)$r->location_id, 'name' => (string)$r->name];
            }
        } catch (Exception $e) {
            $allowedLocationIds = [];
            $allowedLocations = [];
        }
        if (count($allowedLocationIds) === 0) {
            $fallbackId = isset($user->location_id) ? (int)$user->location_id : 1;
            $fallbackName = (string)($user->location_name ?? 'Main');
            $allowedLocationIds = [$fallbackId];
            $allowedLocations = [['id' => $fallbackId, 'name' => $fallbackName]];
        }

        $payload = [
            'iss' => JWT_ISSUER,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + JWT_TTL_SECONDS,
            'sub' => (int)$user->id,
            'email' => $user->email,
            'role' => $user->role,
            'role_id' => isset($user->role_id) ? (int)$user->role_id : null,
            'name' => $user->name,
            'location_id' => isset($user->location_id) ? (int)$user->location_id : 1,
            'location_name' => $user->location_name ?? null,
            'allowed_location_ids' => $allowedLocationIds,
            'allowed_locations' => $allowedLocations,
        ];
        $token = JwtHelper::encode($payload, JWT_SECRET);

        $this->success([
            'token' => $token,
            'user' => [
                'id' => (int)$user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'role_id' => isset($user->role_id) ? (int)$user->role_id : null,
                'location_id' => isset($user->location_id) ? (int)$user->location_id : 1,
                'location_name' => $user->location_name ?? null,
                'allowed_locations' => $allowedLocations,
            ],
        ], 'Login successful');
    }

    // POST /api/auth/register
    public function register() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $name = trim((string)($data['name'] ?? ''));
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');
        // Role assignment is admin-only. Self-registration always defaults to Workshop Officer.
        $role = 'Workshop Officer';

        if ($name === '' || $email === '' || $password === '') {
            $this->error('Name, email and password are required', 400);
            return;
        }
        if ($this->userModel->getByEmail($email)) {
            $this->error('Email already exists', 409);
            return;
        }

        // Map role name -> role_id
        $db = new Database();
        $db->query("SELECT id FROM roles WHERE name = :name LIMIT 1");
        $db->bind(':name', $role);
        $ridObj = $db->single();
        $roleId = $ridObj ? (int)$ridObj->id : 0;
        if ($roleId <= 0) {
            // Default role if unknown role provided
            $db->query("SELECT id FROM roles WHERE name = 'Workshop Officer' LIMIT 1");
            $ridObj = $db->single();
            $roleId = $ridObj ? (int)$ridObj->id : 0;
        }
        if ($roleId <= 0) {
            $this->error('Role configuration missing. Run /install.', 500);
            return;
        }

        $ok = $this->userModel->create([
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_BCRYPT),
            'role_id' => $roleId,
            // Default new users into the main location; Admin can reassign later if needed.
            'location_id' => 1,
            // New accounts must be activated by an admin.
            'is_active' => 0,
        ]);
        if ($ok) {
            $this->success(null, 'User created');
        } else {
            $this->error('Failed to create user');
        }
    }

    // GET /api/auth/me
    public function me() {
        $u = $this->requireAuth();
        $dbUser = $this->userModel->getById((int)$u['sub']);
        $this->success($dbUser);
    }

    public static function permissionDefined($key) {
        try {
            $db = new Database();
            $db->query("SELECT COUNT(*) AS n FROM permissions WHERE perm_key = :k");
            $db->bind(':k', $key);
            return (int)($db->single()->n ?? 0) > 0;
        } catch (Exception $e) { return false; }
    }

    // ------------------------------------------------------------------ Forgot / reset password
    // Reset links are single-use and expire after RESET_TTL_MINUTES. Only a SHA-256 hash of the token is stored.
    // The link host comes from APP_PUBLIC_URL (config), never from the request, so a forged Origin cannot redirect a reset link.
    const RESET_TTL_MINUTES = 60;
    const RESET_MIN_PASSWORD = 8;

    private static function appPublicUrl() {
        return defined('APP_PUBLIC_URL') && APP_PUBLIC_URL !== '' ? APP_PUBLIC_URL : 'http://localhost:9003';
    }

    private function ensurePasswordResetsTable() {
        $db = new Database();
        $db->exec("CREATE TABLE IF NOT EXISTS password_resets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_password_resets_token (token_hash),
            INDEX idx_password_resets_user (user_id)
        )");
    }

    // POST /api/auth/forgot_password  {email}
    // Same answer whether or not the email has an account, so the form cannot be used to find registered emails.
    public function forgot_password() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true);
        $email = strtolower(trim((string)($data['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid email address', 400);
            return;
        }

        $generic = 'If an account exists for that email, a reset link has been sent.';
        try {
            $user = $this->userModel->getByEmail($email);
            $active = $user && (!isset($user->is_active) || (int)$user->is_active === 1);
            if ($active) {
                require_once __DIR__ . '/../helpers/EmailHelper.php';
                $this->ensurePasswordResetsTable();
                $token = bin2hex(random_bytes(32));
                $db = new Database();
                // Only the newest link works: retire any older unused links for this user.
                $db->query("UPDATE password_resets SET used_at = NOW() WHERE user_id = :uid AND used_at IS NULL");
                $db->bind(':uid', (int)$user->id);
                $db->execute();
                $db->query("INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (:uid, :hash, :expires)");
                $db->bind(':uid', (int)$user->id);
                $db->bind(':hash', hash('sha256', $token));
                $db->bind(':expires', date('Y-m-d H:i:s', time() + self::RESET_TTL_MINUTES * 60));
                $db->execute();

                $link = rtrim(self::appPublicUrl(), '/') . '/reset-password?token=' . $token;
                $name = htmlspecialchars((string)($user->name ?? ''), ENT_QUOTES, 'UTF-8');
                $html = "<p>Hi {$name},</p>"
                    . "<p>We received a request to reset your BizzFlow password. Use the link below. It expires in "
                    . self::RESET_TTL_MINUTES . " minutes and can be used once.</p>"
                    . "<p><a href=\"{$link}\">Reset my password</a></p>"
                    . "<p>If the button does not work, open this address: {$link}</p>"
                    . "<p>If you did not ask for this, ignore this email. Your password will not change.</p>";
                EmailHelper::send($user->email, 'Reset your BizzFlow password', $html);

                $this->auditModel->write([
                    'user_id' => (int)$user->id, 'action' => 'password_reset_requested', 'entity' => 'user', 'entity_id' => (int)$user->id,
                    'method' => $_SERVER['REQUEST_METHOD'] ?? '', 'path' => $_SERVER['REQUEST_URI'] ?? '',
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                ]);
            }
        } catch (Throwable $e) {
            // Log server-side only. The caller still gets the generic answer.
            error_log('forgot_password failed: ' . $e->getMessage());
        }
        $this->success(null, $generic);
    }

    // POST /api/auth/reset_password  {token, password}
    public function reset_password() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true);
        $token = trim((string)($data['token'] ?? ''));
        $password = (string)($data['password'] ?? '');
        if ($token === '' || $password === '') {
            $this->error('Token and new password are required', 400);
            return;
        }
        if (strlen($password) < self::RESET_MIN_PASSWORD) {
            $this->error('Password must be at least ' . self::RESET_MIN_PASSWORD . ' characters', 400);
            return;
        }

        $invalid = 'This reset link is invalid or has expired. Request a new one.';
        try {
            $this->ensurePasswordResetsTable();
            $db = new Database();
            $db->query("SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = :hash ORDER BY id DESC LIMIT 1");
            $db->bind(':hash', hash('sha256', $token));
            $row = $db->single();
            if (!$row || $row->used_at !== null || strtotime($row->expires_at) < time()) {
                $this->error($invalid, 400);
                return;
            }

            $db->query("UPDATE users SET password_hash = :ph WHERE id = :uid");
            $db->bind(':ph', password_hash($password, PASSWORD_BCRYPT));
            $db->bind(':uid', (int)$row->user_id);
            $db->execute();

            // Burn every outstanding link for this user, not just the one used.
            $db->query("UPDATE password_resets SET used_at = NOW() WHERE user_id = :uid AND used_at IS NULL");
            $db->bind(':uid', (int)$row->user_id);
            $db->execute();

            $this->auditModel->write([
                'user_id' => (int)$row->user_id, 'action' => 'password_reset_completed', 'entity' => 'user', 'entity_id' => (int)$row->user_id,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '', 'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            ]);
            $this->success(null, 'Password updated. You can sign in now.');
        } catch (Throwable $e) {
            error_log('reset_password failed: ' . $e->getMessage());
            $this->error('Could not reset the password. Try again.', 500);
        }
    }

    // ------------------------------------------------------------------ PIN (POS lock screen)
    // A short numeric PIN used only to unlock a terminal the user is already signed in on.
    // Stored as a bcrypt hash; 5 wrong tries lock PIN unlock for 5 minutes.
    const PIN_MAX_TRIES = 5;
    const PIN_LOCK_MINUTES = 5;

    private function pinRow($userId) {
        $db = new Database();
        $db->query("SELECT id, pin_hash, pin_failed_count, pin_locked_until FROM users WHERE id = :id LIMIT 1");
        $db->bind(':id', (int)$userId);
        return $db->single();
    }

    private function pinAudit($userId, $action) {
        try {
            $this->auditModel->write([
                'user_id' => (int)$userId, 'action' => $action, 'entity' => 'user', 'entity_id' => (int)$userId,
                'method' => $_SERVER['REQUEST_METHOD'] ?? '', 'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '', 'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            ]);
        } catch (Exception $e) { /* audit must never block unlock */ }
    }

    /** 4-6 digits, not all the same, not a straight run (1234, 4321). */
    private function pinProblem($pin) {
        if (!preg_match('/^\d{4,6}$/', $pin)) return 'PIN must be 4 to 6 digits.';
        if (preg_match('/^(\d)\1+$/', $pin)) return 'PIN can\'t be the same digit repeated.';
        $up = true; $down = true;
        for ($i = 1; $i < strlen($pin); $i++) {
            if ((int)$pin[$i] !== ((int)$pin[$i - 1] + 1) % 10) $up = false;
            if ((int)$pin[$i] !== ((int)$pin[$i - 1] + 9) % 10) $down = false;
        }
        if ($up || $down) return 'PIN can\'t be a simple sequence like 1234.';
        return null;
    }

    // GET /api/auth/pin_status
    public function pin_status() {
        $u = $this->requireAuth();
        $row = $this->pinRow($u['sub']);
        $this->success(['has_pin' => !empty($row->pin_hash)]);
    }

    // POST /api/auth/set_pin { pin, current_password }
    // Setting or changing a PIN needs the account password, so someone at an unlocked
    // terminal can't quietly change the owner's PIN.
    public function set_pin() {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $pin = trim((string)($data['pin'] ?? ''));
        $password = (string)($data['current_password'] ?? '');

        if ($problem = $this->pinProblem($pin)) { $this->error($problem, 422); return; }

        $db = new Database();
        $db->query("SELECT password_hash FROM users WHERE id = :id LIMIT 1");
        $db->bind(':id', (int)$u['sub']);
        $row = $db->single();
        if (!$row || !password_verify($password, (string)$row->password_hash)) {
            $this->error('Your current password is incorrect.', 403);
            return;
        }

        $db->query("UPDATE users SET pin_hash = :h, pin_failed_count = 0, pin_locked_until = NULL WHERE id = :id");
        $db->bind(':h', password_hash($pin, PASSWORD_BCRYPT));
        $db->bind(':id', (int)$u['sub']);
        $db->execute();
        $this->pinAudit($u['sub'], 'pin_set');
        $this->success(['has_pin' => true], 'PIN saved');
    }

    // POST /api/auth/verify_pin { pin }  -> unlocks the POS for the signed-in user
    public function verify_pin() {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $pin = trim((string)($data['pin'] ?? ''));

        $row = $this->pinRow($u['sub']);
        if (!$row || empty($row->pin_hash)) { $this->error('No PIN set for this account.', 409); return; }

        if (!empty($row->pin_locked_until) && strtotime($row->pin_locked_until) > time()) {
            $mins = max(1, (int)ceil((strtotime($row->pin_locked_until) - time()) / 60));
            $this->error("Too many wrong PINs. Try again in {$mins} min, or sign in with your password.", 423);
            return;
        }

        $db = new Database();
        if (password_verify($pin, (string)$row->pin_hash)) {
            $db->query("UPDATE users SET pin_failed_count = 0, pin_locked_until = NULL WHERE id = :id");
            $db->bind(':id', (int)$u['sub']);
            $db->execute();
            $this->pinAudit($u['sub'], 'pin_unlock');
            $this->success(['unlocked' => true]);
            return;
        }

        $fails = (int)$row->pin_failed_count + 1;
        $lock = $fails >= self::PIN_MAX_TRIES;
        $db->query("UPDATE users SET pin_failed_count = :f, pin_locked_until = :until WHERE id = :id");
        $db->bind(':f', $lock ? 0 : $fails);
        $db->bind(':until', $lock ? date('Y-m-d H:i:s', time() + self::PIN_LOCK_MINUTES * 60) : null);
        $db->bind(':id', (int)$u['sub']);
        $db->execute();
        $this->pinAudit($u['sub'], 'pin_failed');

        if ($lock) {
            $this->error('Too many wrong PINs. PIN unlock is blocked for ' . self::PIN_LOCK_MINUTES . ' min. Sign in with your password instead.', 423);
            return;
        }
        $left = self::PIN_MAX_TRIES - $fails;
        $this->error("Wrong PIN. {$left} " . ($left === 1 ? 'try' : 'tries') . ' left.', 401);
    }

    // GET /api/auth/permissions
    public function permissions() {
        $u = $this->requireAuth();
        if ($this->isAdmin($u)) {
            $this->success(['*']);
        }

        $role = trim((string)($u['role'] ?? ''));
        $roleId = isset($u['role_id']) ? (int)$u['role_id'] : 0;

        $db = new Database();
        if ($roleId > 0) {
            $db->query("
                SELECT p.perm_key
                FROM role_permissions rp
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = :role_id
                ORDER BY p.perm_key ASC
            ");
            $db->bind(':role_id', $roleId);
        } else {
            $db->query("
                SELECT p.perm_key
                FROM roles r
                INNER JOIN role_permissions rp ON rp.role_id = r.id
                INNER JOIN permissions p ON p.id = rp.permission_id
                WHERE LOWER(r.name) = LOWER(:role)
                ORDER BY p.perm_key ASC
            ");
            $db->bind(':role', $role);
        }
        $rows = $db->resultSet();
        $keys = array_map(function($r) { return $r->perm_key; }, $rows ?: []);

        // Older databases have no "pos.checkout" permission yet: anyone who could use the
        // POS keeps checkout until an admin sets it up (only then can it be withheld from stewards).
        if (in_array('pos.write', $keys, true) && !in_array('pos.checkout', $keys, true) && !self::permissionDefined('pos.checkout')) {
            $keys[] = 'pos.checkout';
        }
        $this->success($keys);
    }
}
