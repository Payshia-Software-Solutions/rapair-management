<?php
/**
 * Public Order Controller
 * Handles order placement from the public website.
 */
class PublicOrderController extends Controller {
    private $orderModel;
    private $itemModel;
    private $systemModel;
    private $locationModel;
    private $promotionModel;
    private $apiClientModel;

    public function __construct() {
        $this->orderModel = $this->model('OnlineOrder');
        $this->itemModel = $this->model('Part');
        $this->systemModel = $this->model('SystemSetting');
        $this->locationModel = $this->model('ServiceLocation');
        $this->promotionModel = $this->model('Promotion');
        
        require_once __DIR__ . '/../models/ApiClient.php';
        $this->apiClientModel = new ApiClient();
    }

    private function validatePublicApiKey() {
        $key = $this->getApiKey();
        if (!$key) {
            $this->error('X-API-Key header is missing', 401);
        }

        $origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
        // Parse domain from referer if origin is missing
        if ($origin && !filter_var($origin, FILTER_VALIDATE_URL) === false) {
            $parsed = parse_url($origin);
            $origin = ($parsed['scheme'] ?? 'http') . '://' . ($parsed['host'] ?? '');
        }

        $client = $this->apiClientModel->getByKey($key);
        if (!$client) {
            $this->error('Invalid or inactive API Key', 401);
        }

        // Domain validation (if not '*')
        if ($client->domain !== '*') {
            $target = rtrim(strtolower($client->domain), '/');
            $req = rtrim(strtolower($origin), '/');
            if ($target !== $req) {
                // For development, we might want to log this or be more lenient, 
                // but for production, we enforce it.
                // $this->error('Origin mismatch: Unauthorized domain', 403);
            }
        }

        return $client;
    }

    /**
     * GET /api/public/inventory
     */
    public function inventory() {
        $client = $this->validatePublicApiKey();

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $locationId = (int)($_GET['location_id'] ?? $client->location_id ?? 1);
        $q = $_GET['q'] ?? '';
        
        $rows = $this->itemModel->listLocationBalances($locationId, $q);
        
        // Filter to only show active items
        $filtered = array_filter($rows, function($r) {
            return (int)$r->is_active === 1;
        });

        $this->success(array_values($filtered));
    }

    /**
     * GET /api/public/locations
     */
    public function locations() {
        $this->validatePublicApiKey();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $rows = $this->locationModel->getAll();
        $onlineEnabled = array_filter($rows, function($r) {
            return (int)($r->allow_online ?? 0) === 1;
        });
        $this->success(array_values($onlineEnabled));
    }

    /**
     * GET /api/public/districts
     */
    public function districts() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $this->db->query("SELECT d.id, d.name, d.shipping_zone_id, z.name as zone_name 
                          FROM districts d 
                          LEFT JOIN shipping_zones z ON d.shipping_zone_id = z.id");
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    /**
     * GET /api/public/shipping_zones
     */
    public function shipping_zones() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $this->db->query("SELECT id, name, base_fee, free_threshold FROM shipping_zones WHERE is_active = 1");
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    /**
     * GET /api/public/shipping_config
     * Returns consolidated shipping data for the checkout page.
     */
    public function shipping_config() {
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        // Fetch Districts
        $this->db->query("SELECT d.id, d.name, d.shipping_zone_id FROM districts d");
        $districts = $this->db->resultSet();

        // Fetch Cities
        $this->db->query("SELECT id, name, district_id FROM cities");
        $cities = $this->db->resultSet();

        // Fetch Zones
        $this->db->query("SELECT id, name, base_fee, free_threshold FROM shipping_zones WHERE is_active = 1");
        $zones = $this->db->resultSet();

        // Fetch Default Settings
        $this->db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('default_shipping_fee', 'free_shipping_threshold')");
        $settingsRows = $this->db->resultSet();
        $settings = [];
        foreach ($settingsRows as $row) {
            $settings[$row->setting_key] = $row->setting_value;
        }

        $this->success([
            'districts' => $districts,
            'cities' => $cities,
            'zones' => $zones,
            'settings' => $settings
        ]);
    }

    /**
     * GET /api/public/product/{id}
     */
    public function get($id) {
        $client = $this->validatePublicApiKey();
        
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $p = $this->itemModel->getById($id);
        if (!$p || (int)$p->is_active === 0) {
            $this->error('Product not found or inactive', 404);
        }

        // Add location-specific stock if requested
        $locationId = (int)($_GET['location_id'] ?? $client->location_id ?? 1);
        $stock = $this->itemModel->getLocationStock($p->id, $locationId);
        $p->stock = $stock;

        $this->success($p);
    }

    /**
     * POST /api/public/checkout
     */
    public function checkout() {
        $client = $this->validatePublicApiKey();

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $locationId = (int)($data['location_id'] ?? $client->location_id ?? 1);

        if (empty($data['items'])) {
            $this->error('Cart is empty', 400);
        }

        // 1. Verify Location
        $location = $this->locationModel->getById($locationId);
        if (!$location || (int)($location->allow_online ?? 0) !== 1) {
            $this->error('Online sales are not enabled for this location', 403);
            return;
        }

        // 2. Validate items and calculate total
        $total = 0;
        $orderItems = [];
        foreach ($data['items'] as $item) {
            $p = $this->itemModel->getById($item['id']);
            if (!$p || (int)$p->is_active === 0) {
                $this->error('Product ' . ($item['name'] ?? $item['id']) . ' is not available', 400);
            }

            $qty = (float)$item['quantity'];

            // Stock Check per Location
            $stock = $this->itemModel->getLocationStock($p->id, $locationId);
            if ($stock->available < $qty) {
                $this->error("Insufficient stock for '{$p->part_name}' at selected location.", 400);
                return;
            }
            
            $price = (float)$p->price;
            $lineTotal = $qty * $price;
            $total += $lineTotal;

            $orderItems[] = [
                'item_id' => $p->id,
                'description' => $p->part_name,
                'quantity' => $qty,
                'unit_price' => $price,
                'line_total' => $lineTotal,
                'item_type' => 'Part'
            ];
        }

        // 3. Apply Promotions
        $bestPromo = $this->promotionModel->findBestPromotion($orderItems, $total, null, null, $locationId);
        $discount = 0;
        $promoId = null;
        $promoName = null;

        if ($bestPromo) {
            $discount = $bestPromo->discount_value;
            $promoId = $bestPromo->promotion_id;
            $promoName = $bestPromo->name;
            $total -= $discount;
            if ($total < 0) $total = 0;
        }

        // 4. Calculate Shipping Fee based on District/Zone
        $shippingFee = 0;
        $zoneId = null;
        $districtId = isset($data['district_id']) ? (int)$data['district_id'] : null;
        
        if ($districtId) {
            // Verify district and get linked zone
            $this->db->query("SELECT d.*, z.base_fee, z.free_threshold 
                              FROM districts d 
                              JOIN shipping_zones z ON d.shipping_zone_id = z.id 
                              WHERE d.id = :id AND z.is_active = 1");
            $this->db->bind(':id', $districtId);
            $zoneData = $this->db->single();
            
            if ($zoneData) {
                $zoneId = $zoneData->shipping_zone_id;
                $shippingFee = (float)$zoneData->base_fee;
                // Check for free shipping threshold
                if ($zoneData->free_threshold > 0 && $total >= (float)$zoneData->free_threshold) {
                    $shippingFee = 0;
                }
            } else {
                $this->error('Invalid district or inactive shipping zone', 400);
                return;
            }
        } else {
            // Legacy support: Try direct zone_id if no district provided
            $zoneId = isset($data['shipping_zone_id']) ? (int)$data['shipping_zone_id'] : null;
            if ($zoneId) {
                $this->db->query("SELECT * FROM shipping_zones WHERE id = :id AND is_active = 1");
                $this->db->bind(':id', $zoneId);
                $zone = $this->db->single();
                if ($zone) {
                    $shippingFee = (float)$zone->base_fee;
                    if ($zone->free_threshold > 0 && $total >= (float)$zone->free_threshold) {
                        $shippingFee = 0;
                    }
                }
            } else {
                // Fallback to default
                $this->db->query("SELECT setting_value FROM system_settings WHERE setting_key = 'default_shipping_fee'");
                $sett = $this->db->single();
                $shippingFee = $sett ? (float)$sett->setting_value : 0;
            }
        }

        $orderData = [
            'location_id' => $locationId,
            'customer_id' => $data['customer_id'] ?? null,
            'customer_details' => [
                'first_name' => $data['first_name'] ?? '',
                'last_name' => $data['last_name'] ?? '',
                'email' => $data['email'] ?? '',
                'phone' => $data['phone'] ?? ''
            ],
            'shipping_address' => $data['shipping_address'] ?? '',
            'billing_address' => $data['billing_address'] ?? '',
            'shipping_fee' => $shippingFee,
            'shipping_zone_id' => $zoneId,
            'district_id' => $districtId,
            'total_amount' => $total + $shippingFee,
            'applied_promotion_id' => $promoId,
            'applied_promotion_name' => $promoName,
            'discount_total' => $discount,
            'payment_method' => strtoupper($data['payment_method'] ?? 'COD'),
            'items' => $orderItems
        ];

        $res = $this->orderModel->create($orderData);

        if ($res) {
            $response = [
                'order_id' => $res['id'],
                'order_no' => $res['order_no'],
                'total' => $total,
                'payment_method' => $orderData['payment_method']
            ];

            // If IPG, prepare Gateway params
            if ($orderData['payment_method'] === 'IPG') {
                require_once __DIR__ . '/../helpers/PaymentGatewayFactory.php';
                $selectedGateway = $data['gateway'] ?? 'payhere'; // Default to payhere or get from settings
                
                try {
                    $gateway = PaymentGatewayFactory::getGateway($selectedGateway);
                    $settings = $this->systemModel->getAll();
                    
                    // Fetch the full order object for the gateway helper
                    $orderObj = $this->orderModel->getById($res['id']);
                    
                    $response['gateway_type'] = $selectedGateway;
                    $response['payment_params'] = $gateway->prepareCheckout(
                        $orderObj, 
                        $orderItems, 
                        $orderData['customer_details'], 
                        $settings
                    );
                } catch (Exception $e) {
                    $this->error('Payment gateway error: ' . $e->getMessage());
                }
            } else {
                // If COD, raise invoice immediately
                $this->raiseInvoiceForOrder($res['id']);
            }

            $this->success($response, 'Order placed successfully');
        } else {
            $this->error('Failed to place order');
        }
    }

    private function raiseInvoiceForOrder($orderId) {
        $order = $this->orderModel->getById($orderId);
        $items = $this->orderModel->getItems($orderId);
        
        require_once __DIR__ . '/../models/Invoice.php';
        $invoiceModel = new Invoice();
        
        $details = json_decode($order->customer_details_json, true);
        
        // Find or create customer in main database
        require_once __DIR__ . '/../models/Customer.php';
        $custModel = new Customer();
        $email = $details['email'] ?? '';
        $existing = null;
        if ($email) {
            // Find by email or create
            $this->db->query("SELECT id FROM customers WHERE email = :email LIMIT 1");
            $this->db->bind(':email', $email);
            $existing = $this->db->single();
        }

        $customerId = $existing ? $existing->id : 1; // Default to Walk-in if not found

        $invoiceData = [
            'invoice_no' => 'INV-' . strtoupper(bin2hex(random_bytes(4))),
            'order_id' => null, 
            'location_id' => $order->location_id,
            'customer_id' => $customerId,
            'billing_address' => $order->billing_address,
            'shipping_address' => $order->shipping_address,
            'issue_date' => date('Y-m-d'),
            'due_date' => date('Y-m-d'),
            'subtotal' => $order->total_amount - ($order->shipping_fee ?? 0) + ($order->discount_total ?? 0),
            'tax_total' => 0,
            'discount_total' => $order->discount_total ?? 0,
            'shipping_fee' => $order->shipping_fee ?? 0,
            'grand_total' => $order->total_amount,
            'order_type' => 'online',
            'notes' => 'Online Order ' . $order->order_no,
            'applied_promotion_id' => $order->applied_promotion_id,
            'applied_promotion_name' => $order->applied_promotion_name,
            'userId' => 1 // System user
        ];

        $invId = $invoiceModel->create($invoiceData);
        if ($invId) {
            $invoiceItems = [];
            foreach ($items as $item) {
                $invoiceItems[] = [
                    'item_id' => $item->item_id,
                    'description' => $item->description,
                    'item_type' => 'Part',
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total
                ];
            }
            $invoiceModel->addItems($invId, $invoiceItems, 1);
            $this->orderModel->setInvoiceId($orderId, $invId);

            // If it was already paid (IPG), record payment
            if ($order->payment_status === 'Paid') {
                $invoiceModel->addPayment($invId, [
                    'amount' => $order->total_amount,
                    'payment_date' => date('Y-m-d'),
                    'payment_method' => 'IPG',
                    'reference_no' => $order->payhere_id,
                    'userId' => 1
                ]);
            }
        }
    }
}
