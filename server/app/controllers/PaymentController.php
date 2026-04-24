<?php
/**
 * Payment Controller
 * Handles payment gateway notifications (webhooks).
 */
class PaymentController extends Controller {
    private $orderModel;
    private $systemModel;

    public function __construct() {
        $this->orderModel = $this->model('OnlineOrder');
        $this->systemModel = $this->model('SystemSetting');
    }

    /**
     * POST /api/payment/payhere_notify
     */
    public function payhere_notify() {
        require_once __DIR__ . '/../helpers/PaymentGatewayFactory.php';
        
        $data = $_POST;
        $settings = $this->systemModel->getAll();

        try {
            $gateway = PaymentGatewayFactory::getGateway('payhere');
            if (!$gateway->validateNotification($data, $settings)) {
                error_log("PayHere Hash Validation Failed for Order: " . ($data['order_id'] ?? 'Unknown'));
                exit('Invalid hash');
            }
        } catch (Exception $e) {
            error_log("Payment Gateway Error: " . $e->getMessage());
            exit('Error');
        }

        $orderNo = $data['order_id'];
        $statusCode = (int)$data['status_code'];
        $payhereId = $data['payment_id'];

        $order = $this->orderModel->getByOrderNo($orderNo);
        if (!$order) {
            error_log("PayHere Notification: Order not found: " . $orderNo);
            exit('Order not found');
        }

        if ($statusCode === 2) { // Success
            $this->orderModel->updatePaymentStatus($order->id, 'Paid', $payhereId);
            
            // Raise invoice if not already raised (or update existing)
            if (!$order->invoice_id) {
                $this->raiseInvoiceForOrder($order->id);
            } else {
                // If invoice exists, record the payment
                require_once __DIR__ . '/../models/Invoice.php';
                $invModel = new Invoice();
                $invModel->addPayment($order->invoice_id, [
                    'amount' => (float)$data['payhere_amount'],
                    'payment_date' => date('Y-m-d'),
                    'payment_method' => 'IPG',
                    'reference_no' => $payhereId,
                    'userId' => 1
                ]);
            }
        } elseif ($statusCode === -2) { // Failed
            $this->orderModel->updatePaymentStatus($order->id, 'Failed', $payhereId);
        }

        echo "OK";
    }

    private function raiseInvoiceForOrder($orderId) {
        // Shared logic with PublicOrderController
        // In a real project, this should be moved to a Service class
        $order = $this->orderModel->getById($orderId);
        $items = $this->orderModel->getItems($orderId);
        
        require_once __DIR__ . '/../models/Invoice.php';
        $invoiceModel = new Invoice();
        
        $details = json_decode($order->customer_details_json, true);
        
        require_once __DIR__ . '/../models/Customer.php';
        $custModel = new Customer();
        $email = $details['email'] ?? '';
        $existing = null;
        if ($email) {
            $this->db->query("SELECT id FROM customers WHERE email = :email LIMIT 1");
            $this->db->bind(':email', $email);
            $existing = $this->db->single();
        }

        $customerId = $existing ? $existing->id : 1;

        $invoiceData = [
            'invoice_no' => 'INV-' . strtoupper(bin2hex(random_bytes(4))),
            'order_id' => null,
            'location_id' => 1,
            'customer_id' => $customerId,
            'billing_address' => $order->billing_address,
            'shipping_address' => $order->shipping_address,
            'issue_date' => date('Y-m-d'),
            'due_date' => date('Y-m-d'),
            'subtotal' => $order->total_amount,
            'tax_total' => 0,
            'discount_total' => 0,
            'grand_total' => $order->total_amount,
            'order_type' => 'online',
            'notes' => 'Online Order ' . $order->order_no,
            'userId' => 1
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

            // Add payment since PayHere notified us of success
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
