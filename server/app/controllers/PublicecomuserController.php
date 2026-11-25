<?php
/**
 * Public E-commerce User Controller
 * Storefront customer accounts: register, sign in / out, profile, and the customer's own orders.
 *
 * Signed in customers send "Authorization: Bearer <token>". A token only ever gives access to that customer's own
 * profile and orders; anything not matched to the token returns 401 or 404.
 */
require_once '../app/helpers/CustomerAuth.php';
require_once '../app/helpers/StorefrontAccountSchema.php';

class PublicecomuserController extends Controller {
    private $db;
    private $apiClientModel;

    public function __construct() {
        $this->db = new Database();
        $this->apiClientModel = $this->model('ApiClient');
    }

    private function handlePublicCors() {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $apiKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: X-API-Key, Content-Type, Authorization');
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            if (!empty($apiKey) && !empty($origin) && $this->apiClientModel->validate($apiKey, $origin)) {
                header('Access-Control-Allow-Origin: ' . $origin);
            } else {
                header('Access-Control-Allow-Origin: *');
            }
            http_response_code(204);
            exit;
        }
        if (!empty($origin) && !empty($apiKey) && $this->apiClientModel->validate($apiKey, $origin)) {
            header('Access-Control-Allow-Origin: ' . $origin);
        } else {
            header('Access-Control-Allow-Origin: *');
        }
    }

    private function validatePublicApiKey() {
        $this->handlePublicCors();
        $headerKey = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (empty($headerKey) || !$this->apiClientModel->validate($headerKey, $origin)) {
            $this->error('Unauthorized', 403);
        }
    }

    /** The signed-in storefront customer's ID, or a 401 response. */
    private function requireCustomerId() {
        $id = CustomerAuth::customerIdFromRequest();
        if (!$id) $this->error('Please sign in again.', 401);

        // The token is only as good as the account: a disabled or non-storefront customer is signed out.
        $this->db->query("SELECT id FROM customers WHERE id = :id AND is_ecommerce_user = 1 AND is_active = 1 LIMIT 1");
        $this->db->bind(':id', $id);
        if (!$this->db->single()) $this->error('Please sign in again.', 401);
        return $id;
    }

    private function profileFor($id) {
        StorefrontAccountSchema::ensureBilling($this->db);
        $this->db->query("SELECT id, name, email, phone, address, city, postal_code, storefront_billing FROM customers WHERE id = :id LIMIT 1");
        $this->db->bind(':id', $id);
        $profile = $this->db->single();
        if (!$profile) return null;
        $profile->billing = json_decode($profile->storefront_billing ?? 'null', true);
        unset($profile->storefront_billing);
        return $profile;
    }

    /** POST /api/publicecomuser/register */
    public function register() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['email']) || empty($data['password']) || empty($data['name'])) {
            $this->error('Missing required fields', 400);
        }
        if (strlen((string)$data['password']) < 8) {
            $this->error('Password must be at least 8 characters.', 400);
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $this->error('Enter a valid email address.', 400);
        }

        $this->db->query("SELECT id FROM customers WHERE email = :email LIMIT 1");
        $this->db->bind(':email', $data['email']);
        if ($this->db->single()) {
            $this->error('Email already registered', 409);
        }

        $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);

        $this->db->query("
            INSERT INTO customers (name, email, phone, address, city, postal_code, password, is_ecommerce_user, is_active)
            VALUES (:name, :email, :phone, :address, :city, :postal_code, :password, 1, 1)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':email', $data['email']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':city', $data['city'] ?? null);
        $this->db->bind(':postal_code', $data['postal_code'] ?? null);
        $this->db->bind(':password', $hashedPassword);

        if ($this->db->execute()) {
            $userId = $this->db->lastInsertId();
            // Signed in straight away, so the shopper does not have to type the password twice.
            $this->success([
                'id' => $userId,
                'user' => $this->profileFor($userId),
                'token' => CustomerAuth::issue($userId),
                'message' => 'Registration successful',
            ]);
        } else {
            $this->error('Registration failed', 500);
        }
    }

    /** POST /api/publicecomuser/login */
    public function login() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['email']) || empty($data['password'])) {
            $this->error('Email and password required', 400);
        }

        require_once __DIR__ . '/../helpers/LoginGuard.php';
        if ($msg = LoginGuard::blocked((string)$data['email'], 'shop')) $this->error($msg, 429);

        $this->db->query("SELECT * FROM customers WHERE email = :email AND is_ecommerce_user = 1 AND is_active = 1 LIMIT 1");
        $this->db->bind(':email', $data['email']);
        $user = $this->db->single();

        // Accounts created with Google have no password, so they can only sign in with Google.
        $okLogin = $user && !empty($user->password) && password_verify($data['password'], $user->password);
        if ($okLogin) LoginGuard::succeed((string)$data['email'], 'shop'); else LoginGuard::fail((string)$data['email'], 'shop');
        if ($okLogin) {
            $this->db->query("UPDATE customers SET last_login = NOW() WHERE id = :id");
            $this->db->bind(':id', $user->id);
            $this->db->execute();

            $this->success([
                'user' => $this->profileFor($user->id),
                'token' => CustomerAuth::issue($user->id),
                'expires_in' => CustomerAuth::TTL_SECONDS,
            ]);
        } else {
            // Same message for a wrong email and a wrong password, so accounts cannot be discovered this way.
            $this->error('Invalid email or password', 401);
        }
    }

    /**
     * POST /api/publicecomuser/google  { credential: "<Google ID token>" }
     * Google checks the token (signature, expiry, audience); we accept only our own client ID and a verified email.
     * The customer with that email is signed in, or created when new. Needs GOOGLE_CLIENT_ID in config/config.php.
     */
    public function google() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);

        $clientId = defined('GOOGLE_CLIENT_ID') ? (string)GOOGLE_CLIENT_ID : '';
        if ($clientId === '') $this->error('Google sign-in is not set up', 503);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $idToken = trim((string)($data['credential'] ?? ''));
        if ($idToken === '') $this->error('Missing Google credential', 400);

        $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8]);
        $body = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $info = $body ? json_decode($body, true) : null;

        $verified = ($info['email_verified'] ?? null);
        $emailVerified = $verified === true || $verified === 'true';
        if ($status !== 200 || !is_array($info)
            || ($info['aud'] ?? '') !== $clientId
            || !in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)
            || empty($info['email']) || !$emailVerified) {
            $this->error('Google sign-in failed', 401);
        }

        $email = strtolower(trim($info['email']));
        $this->db->query("SELECT id, is_active, is_ecommerce_user FROM customers WHERE email = :email ORDER BY is_ecommerce_user DESC, id ASC LIMIT 1");
        $this->db->bind(':email', $email);
        $existing = $this->db->single();

        if ($existing) {
            if ((int)$existing->is_active !== 1) $this->error('This account is disabled.', 403);
            $id = (int)$existing->id;
            // A shopper who ordered as a guest becomes a storefront account the first time they sign in.
            if ((int)$existing->is_ecommerce_user !== 1) {
                $this->db->query("UPDATE customers SET is_ecommerce_user = 1 WHERE id = :id");
                $this->db->bind(':id', $id);
                $this->db->execute();
            }
        } else {
            $name = trim((string)($info['name'] ?? '')) ?: strstr($email, '@', true);
            $this->db->query("INSERT INTO customers (name, email, is_ecommerce_user, is_active) VALUES (:name, :email, 1, 1)");
            $this->db->bind(':name', mb_substr($name, 0, 120));
            $this->db->bind(':email', $email);
            if (!$this->db->execute()) $this->error('Could not create the account', 500);
            $id = (int)$this->db->lastInsertId();
        }

        $this->db->query("UPDATE customers SET last_login = NOW() WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->execute();

        $this->success([
            'user' => $this->profileFor($id),
            'token' => CustomerAuth::issue($id),
            'expires_in' => CustomerAuth::TTL_SECONDS,
        ]);
    }

    /** GET /api/publicecomuser/me */
    public function me() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();
        $this->success(['user' => $this->profileFor($id)]);
    }

    /**
     * POST /api/publicecomuser/logout
     * Tokens are stateless, so the site forgets its token; this confirms the request.
     */
    public function logout() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $this->success(['message' => 'Signed out']);
    }

    /** POST /api/publicecomuser/update */
    public function update() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) {
            $this->error('Name is required', 400);
        }

        StorefrontAccountSchema::ensureBilling($this->db);
        $updatesBilling = array_key_exists('billing', $data);
        $billing = null;
        if ($updatesBilling && $data['billing'] !== null) {
            if (!is_array($data['billing'])) $this->error('Invalid billing address', 400);
            $fieldLengths = ['name' => 120, 'address' => 250, 'city' => 80, 'postalCode' => 10, 'countryCode' => 2, 'phone' => 20];
            $billing = [];
            foreach ($fieldLengths as $key => $max) {
                $value = $data['billing'][$key] ?? '';
                if (!is_string($value) || mb_strlen(trim($value)) > $max) $this->error('Invalid billing address', 400);
                $billing[$key] = trim($value);
            }
            $billing['countryCode'] = strtoupper($billing['countryCode']);
            if ($billing['name'] === '' || mb_strlen($billing['address']) < 5 || mb_strlen($billing['city']) < 2 ||
                !preg_match('/^[A-Z]{2}$/', $billing['countryCode'])) {
                $this->error('Billing name, address, city and country are required', 400);
            }
            $billing = json_encode($billing, JSON_THROW_ON_ERROR);
        }

        $billingSql = $updatesBilling ? ', storefront_billing = :billing' : '';
        $this->db->query("
            UPDATE customers
            SET name = :name, phone = :phone, address = :address, city = :city, postal_code = :postal_code$billingSql
            WHERE id = :id AND is_ecommerce_user = 1
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':city', $data['city'] ?? null);
        $this->db->bind(':postal_code', $data['postal_code'] ?? null);
        if ($updatesBilling) $this->db->bind(':billing', $billing);
        $this->db->bind(':id', $id);

        if ($this->db->execute()) {
            $this->success(['user' => $this->profileFor($id), 'message' => 'Profile updated successfully']);
        } else {
            $this->error('Update failed', 500);
        }
    }

    /** GET /api/publicecomuser/orders: the signed-in customer's orders, newest first. */
    public function orders() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();

        $this->db->query("
            SELECT o.id, o.order_no, o.total_amount, o.currency_code, o.payment_status, o.order_status,
                   o.quote_status, o.created_at, o.tracking_no, o.shipping_carrier, l.name AS location_name
            FROM online_orders o
            LEFT JOIN service_locations l ON l.id = o.location_id
            WHERE o.customer_id = :id
            ORDER BY o.created_at DESC
            LIMIT 100
        ");
        $this->db->bind(':id', $id);
        $rows = $this->db->resultSet();

        $this->success(array_map(function ($o) {
            return [
                'id' => (string)$o->id,
                'order_no' => (string)$o->order_no,
                'total_amount' => (string)$o->total_amount,
                'currency_code' => (string)($o->currency_code ?? ''),
                'payment_status' => (string)$o->payment_status,
                'order_status' => (string)$o->order_status,
                'quote_status' => $o->quote_status ?? null,
                'created_at' => (string)$o->created_at,
                'location_name' => (string)($o->location_name ?? ''),
                'tracking_no' => (string)($o->tracking_no ?? ''),
                'shipping_carrier' => (string)($o->shipping_carrier ?? ''),
            ];
        }, $rows));
    }

    public function overviewCounts() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();
        StorefrontAccountSchema::ensureWishlist($this->db);
        $this->db->query("
            SELECT
                (SELECT COUNT(*) FROM online_orders WHERE customer_id = :orders_customer) AS orders,
                (SELECT COUNT(DISTINCT i.item_id)
                 FROM online_order_items i JOIN online_orders o ON o.id = i.order_id
                 WHERE o.customer_id = :purchases_customer AND o.order_status <> 'Cancelled'
                   AND (o.payment_status = 'Paid' OR o.order_status IN ('Shipped', 'Completed'))) AS purchases,
                (SELECT COUNT(*) FROM product_reviews WHERE customer_id = :reviews_customer) AS reviews,
                (SELECT COUNT(*) FROM storefront_wishlist WHERE customer_id = :wishlist_customer) AS wishlist
        ");
        $this->db->bind(':orders_customer', $id);
        $this->db->bind(':purchases_customer', $id);
        $this->db->bind(':reviews_customer', $id);
        $this->db->bind(':wishlist_customer', $id);
        $this->success($this->db->single());
    }

    /** Account data is always scoped to the customer in the bearer token. */
    public function activity() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();

        $this->db->query("
            SELECT i.item_id AS product_id, COALESCE(MAX(p.part_name), MAX(i.description)) AS name,
                   SUM(i.quantity) AS quantity, MAX(o.created_at) AS last_purchased
            FROM online_order_items i
            JOIN online_orders o ON o.id = i.order_id
            LEFT JOIN parts p ON p.id = i.item_id
            WHERE o.customer_id = :customer AND i.item_id IS NOT NULL AND o.order_status <> 'Cancelled'
              AND (o.payment_status = 'Paid' OR o.order_status IN ('Shipped', 'Completed'))
            GROUP BY i.item_id
            ORDER BY last_purchased DESC, i.item_id DESC
        ");
        $this->db->bind(':customer', $id);
        $purchases = $this->db->resultSet();

        $this->db->query("
            SELECT r.id, r.part_id AS product_id, p.part_name AS name, r.rating, r.comment,
                   r.status, r.created_at, r.admin_reply
            FROM product_reviews r JOIN parts p ON p.id = r.part_id
            WHERE r.customer_id = :customer ORDER BY r.created_at DESC, r.id DESC
        ");
        $this->db->bind(':customer', $id);
        $reviews = $this->db->resultSet();

        StorefrontAccountSchema::ensureWishlist($this->db);
        $this->db->query("
            SELECT w.part_id AS product_id, p.part_name AS name, w.created_at
            FROM storefront_wishlist w JOIN parts p ON p.id = w.part_id
            WHERE w.customer_id = :customer ORDER BY w.created_at DESC, w.part_id DESC
        ");
        $this->db->bind(':customer', $id);
        $this->success(['purchases' => $purchases, 'reviews' => $reviews, 'wishlist' => $this->db->resultSet()]);
    }

    public function wishlist() {
        $this->validatePublicApiKey();
        $id = $this->requireCustomerId();
        StorefrontAccountSchema::ensureWishlist($this->db);
        if ($_SERVER['REQUEST_METHOD'] === 'GET') {
            $this->db->query('SELECT part_id FROM storefront_wishlist WHERE customer_id = :customer');
            $this->db->bind(':customer', $id);
            $this->success(['ids' => array_map(fn($row) => (int)$row->part_id, $this->db->resultSet())]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $partId = filter_var($data['productId'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if (!$partId || !is_bool($data['saved'] ?? null)) $this->error('Invalid wishlist item', 400);
        if ($data['saved']) {
            $this->db->query("
                INSERT INTO storefront_wishlist (customer_id, part_id)
                SELECT :customer, id FROM parts WHERE id = :part AND is_online = 1 AND is_active = 1
                ON DUPLICATE KEY UPDATE created_at = storefront_wishlist.created_at
            ");
        } else {
            $this->db->query('DELETE FROM storefront_wishlist WHERE customer_id = :customer AND part_id = :part');
        }
        $this->db->bind(':customer', $id);
        $this->db->bind(':part', $partId);
        $this->db->execute();
        $this->db->query('SELECT part_id FROM storefront_wishlist WHERE customer_id = :customer AND part_id = :part');
        $this->db->bind(':customer', $id);
        $this->db->bind(':part', $partId);
        $saved = (bool)$this->db->single();
        if ($data['saved'] && !$saved) $this->error('This product is unavailable', 404);
        $this->success(['saved' => $saved]);
    }

    /** GET /api/publicecomuser/order?order_no=...: one of the signed-in customer's orders, with its items. */
    public function order() {
        $this->validatePublicApiKey();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        $id = $this->requireCustomerId();

        $orderNo = trim((string)($_GET['order_no'] ?? ''));
        if ($orderNo === '') $this->error('Order number is required', 400);

        require_once '../app/models/OnlineOrder.php';
        $orderModel = new OnlineOrder();
        $order = $orderModel->getByOrderNo($orderNo);
        // Another customer's order is reported as not found, the same as a missing one.
        if (!$order || (int)$order->customer_id !== $id) $this->error('Order not found', 404);

        $items = $orderModel->getItems($order->id);
        $this->success([
            'order_no' => (string)$order->order_no,
            'created_at' => (string)$order->created_at,
            'subtotal_amount' => (string)$order->subtotal_amount,
            'tax_total' => (string)$order->tax_total,
            'shipping_fee' => (string)$order->shipping_fee,
            'coupon_code' => (string)$order->coupon_code,
            'coupon_discount' => (string)$order->coupon_discount,
            'total_amount' => (string)$order->total_amount,
            'currency_code' => (string)($order->currency_code ?? ''),
            'payment_method' => (string)$order->payment_method,
            'payment_status' => (string)$order->payment_status,
            'order_status' => (string)$order->order_status,
            'quote_status' => $order->quote_status ?? null,
            'shipping_address' => (string)$order->shipping_address,
            'billing_address' => (string)($order->billing_address ?? ''),
            'tracking_no' => (string)($order->tracking_no ?? ''),
            'shipping_carrier' => (string)($order->shipping_carrier ?? ''),
            'items' => array_map(function ($item) {
                return [
                    'product_id' => (string)$item->item_id,
                    'product_name' => (string)$item->description,
                    'quantity' => (string)$item->quantity,
                    'unit_price' => (string)$item->unit_price,
                    'discount' => (string)$item->discount,
                    'line_total' => (string)$item->line_total,
                ];
            }, $items),
        ]);
    }
}
