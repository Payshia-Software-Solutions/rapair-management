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

        $now = time();

        // Allowed locations for this user (supports multi-location assignment).
        $allowedLocationIds = [];
        try {
            $db = new Database();
            $db->query("SELECT location_id FROM user_locations WHERE user_id = :uid ORDER BY location_id ASC");
            $db->bind(':uid', (int)$user->id);
            $locRows = $db->resultSet() ?: [];
            foreach ($locRows as $r) {
                $allowedLocationIds[] = (int)$r->location_id;
            }
        } catch (Exception $e) {
            $allowedLocationIds = [];
        }
        if (count($allowedLocationIds) === 0) {
            $allowedLocationIds = [isset($user->location_id) ? (int)$user->location_id : 1];
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

    // GET /api/auth/permissions
    public function permissions() {
        $u = $this->requireAuth();
        $role = (string)($u['role'] ?? '');
        if ($role === 'Admin') {
            $this->success(['*']);
        }

        $db = new Database();
        $db->query("
            SELECT p.perm_key
            FROM roles r
            INNER JOIN role_permissions rp ON rp.role_id = r.id
            INNER JOIN permissions p ON p.id = rp.permission_id
            WHERE r.name = :role
            ORDER BY p.perm_key ASC
        ");
        $db->bind(':role', $role);
        $rows = $db->resultSet();
        $keys = array_map(function($r) { return $r->perm_key; }, $rows ?: []);
        $this->success($keys);
    }
}
