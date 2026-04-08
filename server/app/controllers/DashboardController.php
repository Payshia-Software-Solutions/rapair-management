<?php
/**
 * Dashboard Controller
 * Provides statistics overview.
 */

class DashboardController extends Controller {
    private $orderModel;

    public function __construct() {
        $this->orderModel = $this->model('Order');
    }

    // GET /api/dashboard/summary
    public function summary() {
        $orders = $this->orderModel->getOrders();
        
        $stats = [
            'Pending' => 0,
            'In Progress' => 0,
            'Completed' => 0,
            'Cancelled' => 0
        ];

        foreach ($orders as $order) {
            if (isset($stats[$order->status])) {
                $stats[$order->status]++;
            }
        }

        $this->success([
            'total_orders' => count($orders),
            'breakdown' => $stats,
            'recent_activity' => array_slice($orders, 0, 5) // Last 5 orders
        ]);
    }
}
