<?php
/**
 * Customer Controller
 */

class CustomerController extends Controller {
    private $customerModel;

    public function __construct() {
        $this->customerModel = $this->model('Customer');
    }

    public function index() {
        $this->list();
    }

    public function list() {
        $this->requirePermission(['customers.read', 'pos.read', 'orders.read', 'sales.read']);
        $customers = $this->customerModel->getAll();
        $this->success($customers);
    }

    public function ecommerce() {
        $this->requirePermission('customers.read');
        $customers = $this->customerModel->getEcommerceCustomers();
        $this->success($customers);
    }

    public function get($id) {
        $this->requirePermission(['customers.read', 'pos.read', 'orders.read', 'sales.read']);
        $customer = $this->customerModel->getById($id);
        if ($customer) {
            $this->success($customer);
        } else {
            $this->error('Customer not found', 404);
        }
    }

    private function processCustomerInput() {
        $contentType = $_SERVER["CONTENT_TYPE"] ?? '';
        if (strpos($contentType, 'multipart/form-data') !== false) {
            $data = $_POST;
            // Handle file upload
            if (isset($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
                // Images only, judged by their real content; the stored extension comes from that check.
                $imageExt = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];
                $info = @getimagesize($_FILES['photo']['tmp_name']);
                if ($info && isset($imageExt[$info[2]]) && is_uploaded_file($_FILES['photo']['tmp_name']) && $_FILES['photo']['size'] <= 5 * 1024 * 1024) {
                    require_once __DIR__ . '/../helpers/ContentStore.php';
                    try {
                        $stored = ContentStore::save($_FILES['photo']['tmp_name'], 'customers', 'cust_' . time() . '_' . bin2hex(random_bytes(6)) . '.' . $imageExt[$info[2]]);
                        $data['photo_url'] = (strpos($stored, 'http') === 0) ? $stored : '/' . $stored;
                    } catch (Throwable $e) {
                        error_log('Customer photo: ' . $e->getMessage());
                    }
                }
            }
        } else {
            $raw = file_get_contents('php://input');
            $data = json_decode($raw, true) ?? [];
        }
        return $data;
    }

    public function create() {
        $this->requirePermission(['customers.write', 'pos.write', 'orders.write', 'sales.create', 'sales.update']);
        
        $data = $this->processCustomerInput();

        if (empty($data['name'])) {
            $this->error('Customer name is required', 400);
            return;
        }

        $u = $this->requireAuth();
        $userId = $u['sub'] ?? null;

        // Auto-generate QR Hash if not provided
        if (empty($data['qr_code_hash'])) {
            $data['qr_code_hash'] = 'CUSTOMER:' . strtoupper(uniqid());
        }

        $newId = $this->customerModel->create($data, $userId);
        if ($newId) {
            // Update qr hash with real ID if we want
            $data['qr_code_hash'] = 'CUSTOMER:' . $newId;
            $this->customerModel->update($newId, $data, $userId);
            
            $this->success(['id' => $newId, 'qr_code_hash' => $data['qr_code_hash']], 'Customer created successfully');
        } else {
            $this->error('Failed to create customer');
        }
    }

    /**
     * POS: is this phone / NIC already a customer?
     *   GET /api/customer/pos_lookup?phone=&nic=   -> { customer: {...} | null }
     */
    public function pos_lookup() {
        $this->requirePermission(['customers.read', 'pos.read', 'pos.write', 'orders.read', 'orders.write']);
        $nic = Customer::normalizeNic($_GET['nic'] ?? '');
        $this->success(['customer' => $this->customerModel->findByPhoneOrNic($_GET['phone'] ?? '', $nic ?: null)]);
    }

    /**
     * POS customer registration. Phone is required and unique; NIC is optional and unique.
     *   POST /api/customer/pos_register { name, phone, nic?, email?, dob?, address?, enroll_loyalty? }
     * 409 with { existing } when the phone or NIC already belongs to a customer.
     */
    public function pos_register() {
        $u = $this->requirePermission(['customers.write', 'pos.write', 'orders.write']);
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $in = json_decode(file_get_contents('php://input'), true) ?: [];

        $name = trim((string)($in['name'] ?? ''));
        $phone = Customer::normalizePhone($in['phone'] ?? '');
        $nic = Customer::normalizeNic($in['nic'] ?? '');
        $email = trim((string)($in['email'] ?? ''));
        $dob = trim((string)($in['dob'] ?? ''));
        $address = trim((string)($in['address'] ?? ''));

        if ($name === '') { $this->error('Enter the customer name', 422); return; }
        if (strlen($phone) < 9 || strlen($phone) > 15) { $this->error('Enter a valid phone number', 422); return; }
        if ($nic === null) { $this->error('NIC must be 9 digits with V or X, or 12 digits', 422); return; }
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) { $this->error('Enter a valid email', 422); return; }
        if ($dob !== '' && (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dob) || strtotime($dob) === false || $dob > date('Y-m-d'))) {
            $this->error('Enter a valid date of birth', 422); return;
        }

        $existing = $this->customerModel->findByPhoneOrNic($phone, $nic ?: null);
        if ($existing) {
            $what = $existing->matched_on === 'nic' ? 'NIC' : 'phone number';
            $this->json(['status' => 'error', 'message' => "This $what is already registered to {$existing->name}.", 'existing' => $existing], 409);
            return;
        }

        if ($dob !== '') $this->customerModel->ensureDobColumn();
        $id = $this->customerModel->createFromPos(compact('name', 'phone', 'nic', 'email', 'dob', 'address'), $u['sub'] ?? null);
        if (!$id) { $this->error('Could not save the customer'); return; }

        $loyalty = null;
        if (!empty($in['enroll_loyalty'])) {
            require_once __DIR__ . '/../helpers/LoyaltyHelper.php';
            if (!SaasHelper::isModuleEnabled('loyalty')) {
                $loyalty = ['error' => 'Loyalty module is not enabled'];
            } else {
                $db = new Database();
                $m = LoyaltyHelper::run($db, fn() => LoyaltyHelper::enroll($db, $id));
                $loyalty = $m ? ['member_no' => $m->member_no, 'tier' => $m->tier_name, 'points' => (int)$m->points_balance] : ['error' => 'Could not enroll'];
            }
        }

        $this->success(['customer' => $this->customerModel->getById($id), 'loyalty' => $loyalty], 'Customer registered');
    }

    public function update($id) {
        $this->requirePermission('customers.write');
        
        $data = $this->processCustomerInput();

        if (empty($data['name'])) {
            $this->error('Customer name is required', 400);
            return;
        }

        $u = $this->requireAuth();
        $userId = $u['sub'] ?? null;

        if ($this->customerModel->update($id, $data, $userId)) {
            $this->success(null, 'Customer updated successfully');
        } else {
            $this->error('Failed to update customer');
        }
    }

    public function delete($id) {
        $this->requirePermission('customers.write');
        
        if ($this->customerModel->delete($id)) {
            $this->success(null, 'Customer deleted successfully');
        } else {
            $this->error('Failed to delete customer');
        }
    }

    public function vehicles($id) {
        $this->requirePermission(['vehicles.read', 'orders.read', 'orders.write', 'customers.read']);
        $vehicleModel = $this->model('Vehicle');
        $vehicles = $vehicleModel->getByCustomer($id);
        $this->success($vehicles);
    }
    public function summary($id) {
        $this->requirePermission('customers.read');
        $summary = $this->customerModel->getSummary($id);
        if ($summary) {
            $this->success($summary);
        } else {
            $this->error('Customer not found', 404);
        }
    }
}
