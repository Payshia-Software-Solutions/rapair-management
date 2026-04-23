<?php
/**
 * Nexus ERP Portal API
 */
session_start();
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Define root DB connection (using same as saas-provider for consistency)
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'saas_master_db');

class DB {
    private $host = DB_HOST;
    private $user = DB_USER;
    private $pass = DB_PASS;
    private $dbname = DB_NAME;

    private $dbh;
    private $stmt;
    private $error;

    public function __construct() {
        $dsn = 'mysql:host=' . $this->host . ';dbname=' . $this->dbname;
        $options = array(
            PDO::ATTR_PERSISTENT => true,
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
        );
        try {
            $this->dbh = new PDO($dsn, $this->user, $this->pass, $options);
        } catch (PDOException $e) {
            $this->error = $e->getMessage();
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Database connection failed: ' . $this->error]);
            exit;
        }
    }

    public function query($sql) {
        $this->stmt = $this->dbh->prepare($sql);
    }

    public function bind($param, $value, $type = null) {
        if (is_null($type)) {
            switch (true) {
                case is_int($value):
                    $type = PDO::PARAM_INT;
                    break;
                case is_bool($value):
                    $type = PDO::PARAM_BOOL;
                    break;
                case is_null($value):
                    $type = PDO::PARAM_NULL;
                    break;
                default:
                    $type = PDO::PARAM_STR;
            }
        }
        $this->stmt->bindValue($param, $value, $type);
    }

    public function execute() {
        return $this->stmt->execute();
    }

    public function resultSet() {
        $this->execute();
        return $this->stmt->fetchAll(PDO::FETCH_OBJ);
    }

    public function single() {
        $this->execute();
        return $this->stmt->fetch(PDO::FETCH_OBJ);
    }

    public function rowCount() {
        return $this->stmt->rowCount();
    }
}

$db = new DB();

$uri = $_SERVER['REQUEST_URI'];
$base = '/rapair-management/portal-landing/api.php';
$route = str_replace($base, '', $uri);
$route = explode('?', $route)[0];

// --- AUTH LOGIC ---
if ($route === '/login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    $db->query("SELECT * FROM portal_admins WHERE username = :user");
    $db->bind(':user', $username);
    $user = $db->single();

    if ($user && password_verify($password, $user->password)) {
        $_SESSION['admin_id'] = $user->id;
        $_SESSION['admin_user'] = $user->username;
        echo json_encode(['status' => 'success', 'message' => 'Login successful', 'user' => $user->username]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Invalid credentials']);
    }
    exit;
}

if ($route === '/logout') {
    session_destroy();
    echo json_encode(['status' => 'success', 'message' => 'Logged out']);
    exit;
}

if ($route === '/check-auth') {
    if (isset($_SESSION['admin_id'])) {
        echo json_encode(['status' => 'success', 'user' => $_SESSION['admin_user']]);
    } else {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Not authenticated']);
    }
    exit;
}

// --- PUBLIC: REQUEST ERP ---
if ($route === '/request' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $company = $data['company_name'] ?? '';
    $contact = $data['contact_person'] ?? '';
    $email = $data['email'] ?? '';
    $phone = $data['phone'] ?? '';
    $users = $data['expected_users'] ?? 5;
    $package = $data['package_type'] ?? 'Essential';

    if (!$company || !$email) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Company name and email are required']);
        exit;
    }

    $db->query("INSERT INTO erp_requests (company_name, contact_person, email, phone, expected_users, package_type) VALUES (:company, :contact, :email, :phone, :users, :package)");
    $db->bind(':company', $company);
    $db->bind(':contact', $contact);
    $db->bind(':email', $email);
    $db->bind(':phone', $phone);
    $db->bind(':users', $users);
    $db->bind(':package', $package);

    if ($db->execute()) {
        echo json_encode(['status' => 'success', 'message' => 'Request submitted successfully. Our team will contact you soon.']);
    } else {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Submission failed']);
    }
    exit;
}

// --- ADMIN PROTECTED ROUTES ---
function checkAuth() {
    if (!isset($_SESSION['admin_id'])) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized']);
        exit;
    }
}

// List Requests
if ($route === '/admin/requests' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    checkAuth();
    $db->query("SELECT * FROM erp_requests ORDER BY created_at DESC");
    echo json_encode(['status' => 'success', 'data' => $db->resultSet()]);
    exit;
}

// Update Request Status
if ($route === '/admin/requests/update' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    checkAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? 0;
    $status = $data['status'] ?? 'Pending';

    $db->query("UPDATE erp_requests SET status = :status WHERE id = :id");
    $db->bind(':status', $status);
    $db->bind(':id', $id);

    if ($db->execute()) {
        echo json_encode(['status' => 'success', 'message' => 'Status updated']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Update failed']);
    }
    exit;
}

// List Portal Admins
if ($route === '/admin/users' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    checkAuth();
    $db->query("SELECT id, username, full_name, created_at FROM portal_admins");
    echo json_encode(['status' => 'success', 'data' => $db->resultSet()]);
    exit;
}

// Create Portal Admin
if ($route === '/admin/users/create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    checkAuth();
    $data = json_decode(file_get_contents('php://input'), true);
    $user = $data['username'] ?? '';
    $pass = $data['password'] ?? '';
    $name = $data['full_name'] ?? '';

    if (!$user || !$pass) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Username and password required']);
        exit;
    }

    $hashed = password_hash($pass, PASSWORD_BCRYPT);
    $db->query("INSERT INTO portal_admins (username, password, full_name) VALUES (:user, :pass, :name)");
    $db->bind(':user', $user);
    $db->bind(':pass', $hashed);
    $db->bind(':name', $name);

    if ($db->execute()) {
        echo json_encode(['status' => 'success', 'message' => 'Admin created']);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'Creation failed']);
    }
    exit;
}

// 404
http_response_code(404);
echo json_encode(['status' => 'error', 'message' => 'Endpoint not found: ' . $route]);
