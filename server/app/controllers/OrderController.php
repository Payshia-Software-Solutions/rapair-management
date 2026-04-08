<?php
/**
 * Order Controller
 * Handles Repair Order API requests.
 */

class OrderController extends Controller {
    private $orderModel;

    public function __construct() {
        $this->orderModel = $this->model('Order');
    }

    // GET /api/order/list
    public function list() {
        $this->requirePermission('orders.read');
        if ($_SERVER['REQUEST_METHOD'] == 'GET') {
            $orders = $this->orderModel->getOrders();
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

            // Simple validation
            if (!isset($data['customer_name']) || !isset($data['vehicle_model'])) {
                $this->error('Missing required fields', 400);
            }

            if ($this->orderModel->addOrder($data, (int)$u['sub'])) {
                $this->success($data, 'Order created successfully');
            } else {
                $this->error('Failed to create order');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }

    // GET /api/order/get/1
    public function get($id = null) {
        $this->requirePermission('orders.read');
        if (!$id) {
            $this->error('Order ID required', 400);
        }

        $order = $this->orderModel->getOrderById($id);

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

            if ($this->orderModel->updateStatus($id, $data['status'], (int)$u['sub'])) {
                $this->success(['id' => $id, 'status' => $data['status']], 'Status updated');
            } else {
                $this->error('Update failed');
            }
        } else {
            $this->error('Method Not Allowed', 405);
        }
    }
}
