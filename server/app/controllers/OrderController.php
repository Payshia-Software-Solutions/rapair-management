<?php
/**
 * Order Controller
 * Handles Repair Order API requests.
 */

class OrderController extends Controller {
    private $orderModel;
    private $auditModel;

    public function __construct() {
        $this->orderModel = $this->model('Order');
        $this->auditModel = $this->model('AuditLog');
    }

    // GET /api/order/list
    public function list() {
        $u = $this->requirePermission('orders.read');
        if ($_SERVER['REQUEST_METHOD'] == 'GET') {
            $locId = $this->currentLocationId($u);
            $orders = $this->orderModel->getOrdersByLocation($locId);
            $this->success($orders);
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // POST /api/order/create
    public function create() {
        $u = $this->requirePermission('orders.write');
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {
            // Get raw POST data
            $raw_data = file_get_contents('php://input');
            $data = json_decode($raw_data, true);

            // Accept both snake_case and camelCase payloads from the frontend.
            $customerName = $data['customer_name'] ?? $data['customerName'] ?? null;
            $vehicleModel = $data['vehicle_model'] ?? $data['vehicleModel'] ?? null;
            $problem = $data['problem_description'] ?? $data['problemDescription'] ?? null;

            $customerName = is_string($customerName) ? trim($customerName) : '';
            $vehicleModel = is_string($vehicleModel) ? trim($vehicleModel) : '';
            $problem = is_string($problem) ? trim($problem) : '';

            // Customer name is optional (order can be created for walk-in / internal vehicles).
            if ($customerName === '') {
                $customerName = 'Walk-in';
            }

            if ($vehicleModel === '' || $problem === '') {
                $this->error('Missing required fields', 400);
            }

            $payload = [
                'customer_name' => $customerName,
                'vehicle_model' => $vehicleModel,
                'problem_description' => $problem,
                'status' => $data['status'] ?? 'Pending',
                'vehicle_id' => $data['vehicle_id'] ?? $data['vehicleIdDb'] ?? null,
                'vehicle_identifier' => $data['vehicle_identifier'] ?? $data['vehicleId'] ?? null,
                'mileage' => $data['mileage'] ?? null,
                'priority' => $data['priority'] ?? null,
                'expected_time' => $data['expected_time'] ?? $data['expectedTime'] ?? null,
                'comments' => $data['comments'] ?? null,
                'location' => $data['location'] ?? null,
                'technician' => $data['technician'] ?? null,
            ];

            // Store checklist/categories as JSON strings (TEXT columns).
            if (isset($data['categories']) && is_array($data['categories'])) {
                $payload['categories_json'] = json_encode(array_values($data['categories']));
            } elseif (isset($data['categories_json'])) {
                $payload['categories_json'] = $data['categories_json'];
            }
            if (isset($data['checklist']) && is_array($data['checklist'])) {
                $payload['checklist_json'] = json_encode(array_values($data['checklist']));
            } elseif (isset($data['checklist_json'])) {
                $payload['checklist_json'] = $data['checklist_json'];
            }
            if (isset($data['attachments']) && is_array($data['attachments'])) {
                $payload['attachments_json'] = json_encode(array_values($data['attachments']));
            } elseif (isset($data['attachments_json'])) {
                $payload['attachments_json'] = $data['attachments_json'];
            }

            $locId = $this->currentLocationId($u);
            $newId = $this->orderModel->addOrder($payload, (int)$u['sub'], $locId);
            if ($newId) {
                $payload['id'] = (int)$newId;
                $this->auditModel->write([
                    'user_id' => (int)$u['sub'],
                    'location_id' => $locId,
                    'action' => 'create',
                    'entity' => 'repair_order',
                    'entity_id' => (int)$newId,
                    'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                    'path' => $_SERVER['REQUEST_URI'] ?? '',
                    'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                    'details' => json_encode(['vehicle_model' => $vehicleModel, 'priority' => $payload['priority'] ?? null]),
                ]);
                $this->success($payload, 'Order created successfully');
            } else {
                $this->error('Failed to create order');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // GET /api/order/get/1
    public function get($id = null) {
        $u = $this->requirePermission('orders.read');
        if (!$id) {
            $this->error('Order ID required', 400);
        }

        $locId = $this->currentLocationId($u);
        $order = $this->orderModel->getOrderByIdInLocation($id, $locId);

        if ($order) {
            $this->success($order);
        } else {
            $this->error('Order not found', 404);
        }
    }

    // POST /api/order/update_status/1
    public function update_status($id = null) {
        $u = $this->requirePermission('orders.write');
        if ($_SERVER['REQUEST_METHOD'] == 'POST') {
            $raw_data = file_get_contents('php://input');
            $data = json_decode($raw_data, true);

            if (!$id || !isset($data['status'])) {
                $this->error('Missing required data', 400);
            }

            $locId = $this->currentLocationId($u);
            if ($this->orderModel->updateStatus($id, $data['status'], (int)$u['sub'], $locId)) {
                $this->success(['id' => $id, 'status' => $data['status']], 'Status updated');
            } else {
                $this->error('Update failed');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }
}
