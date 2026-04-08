<?php
/**
 * Report Controller
 */
class ReportController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    // GET /api/report/overview
    public function overview() {
        $this->requirePermission('reports.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        // Orders by status
        $this->db->query("SELECT status, COUNT(*) AS cnt FROM repair_orders GROUP BY status");
        $rows = $this->db->resultSet();
        $byStatus = [];
        $totalOrders = 0;
        foreach ($rows as $r) {
            $byStatus[$r->status] = (int)$r->cnt;
            $totalOrders += (int)$r->cnt;
        }

        // Orders per day (last 7 days)
        $this->db->query("
            SELECT DATE(created_at) AS d, COUNT(*) AS cnt
            FROM repair_orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(created_at)
            ORDER BY d ASC
        ");
        $dailyRows = $this->db->resultSet();
        $ordersLast7Days = array_map(function($r) {
            return ['date' => (string)$r->d, 'count' => (int)$r->cnt];
        }, $dailyRows ?: []);

        // Totals
        $counts = [];
        foreach ([
            'vehicles' => 'vehicles',
            'technicians' => 'technicians',
            'service_bays' => 'service_bays',
            'repair_categories' => 'repair_categories',
            'checklist_templates' => 'checklist_templates'
        ] as $k => $tbl) {
            $this->db->query("SELECT COUNT(*) AS cnt FROM {$tbl}");
            $obj = $this->db->single();
            $counts[$k] = $obj ? (int)$obj->cnt : 0;
        }

        $this->success([
            'totalOrders' => $totalOrders,
            'ordersByStatus' => $byStatus,
            'ordersLast7Days' => $ordersLast7Days,
            'counts' => $counts,
        ]);
    }
}

