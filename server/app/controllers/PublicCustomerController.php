<?php
/**
 * PublicCustomerController
 * APIs for Customer Portal (Website Integration)
 */
class PublicCustomerController extends Controller {
    private $customerModel;
    private $orderModel;

    public function __construct() {
        $this->customerModel = $this->model('Customer');
        $this->orderModel = $this->model('OnlineOrder');
        $this->db = new Database();
    }

    /**
     * POST /api/publiccustomer/register
     */
    public function register() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['email']) || empty($data['password']) || empty($data['name'])) {
            $this->error('Missing required fields (email, password, name)', 400);
            return;
        }

        // Check if email exists
        $this->db->query("SELECT id FROM customers WHERE email = :email");
        $this->db->bind(':email', $data['email']);
        if ($this->db->single()) {
            $this->error('Email already registered', 400);
            return;
        }

        $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);

        $this->db->query("
            INSERT INTO customers (name, email, phone, password, is_portal_active, district_id, city_id) 
            VALUES (:name, :email, :phone, :password, 1, :did, :cid)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':password', $passwordHash);
        $this->db->bind(':did', $data['district_id'] ?? null);
        $this->db->bind(':cid', $data['city_id'] ?? null);

        if ($this->db->execute()) {
            $this->success(['id' => $this->db->lastInsertId()], 'Registration successful');
        } else {
            $this->error('Registration failed');
        }
    }

    /**
     * POST /api/publiccustomer/login
     */
    public function login() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['email']) || empty($data['password'])) {
            $this->error('Missing email or password', 400);
            return;
        }

        $this->db->query("SELECT * FROM customers WHERE email = :email AND is_portal_active = 1");
        $this->db->bind(':email', $data['email']);
        $customer = $this->db->single();

        if ($customer && password_verify($data['password'], $customer->password)) {
            // Update last login
            $this->db->query("UPDATE customers SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id");
            $this->db->bind(':id', $customer->id);
            $this->db->execute();

            // Simple token (In a real app, use JWT)
            $token = base64_encode(json_encode(['id' => $customer->id, 'email' => $customer->email, 'time' => time()]));

            $this->success([
                'token' => $token,
                'customer' => [
                    'id' => $customer->id,
                    'name' => $customer->name,
                    'email' => $customer->email,
                    'phone' => $customer->phone
                ]
            ], 'Login successful');
        } else {
            $this->error('Invalid credentials or account disabled', 401);
        }
    }

    /**
     * GET /api/publiccustomer/orders
     * Requires Authorization header with token
     */
    public function orders() {
        $customerId = $this->auth();
        if (!$customerId) return;

        $this->db->query("
            SELECT * FROM online_orders 
            WHERE customer_id = :cid 
            ORDER BY created_at DESC
        ");
        $this->db->bind(':cid', $customerId);
        $orders = $this->db->resultSet();

        $this->success($orders);
    }

    /**
     * GET /api/publiccustomer/profile
     */
    public function profile() {
        $customerId = $this->auth();
        if (!$customerId) return;

        $customer = $this->customerModel->getById($customerId);
        unset($customer->password); // Security

        $this->success($customer);
    }

    /**
     * Helper to authenticate token
     */
    private function auth() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        
        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            $token = $matches[1];
            $decoded = json_decode(base64_decode($token), true);
            
            if ($decoded && isset($decoded['id'])) {
                return $decoded['id'];
            }
        }

        $this->error('Unauthorized', 401);
        return false;
    }
}
