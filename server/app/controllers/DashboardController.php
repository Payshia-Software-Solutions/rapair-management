<?php
/**
 * Dashboard Controller
 * Provides aggregated metrics for the frontend dashboard.
 *
 * GET /api/dashboard/overview
 */

class DashboardController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    // GET /api/dashboard/overview
    public function overview() {
        $u = $this->requirePermission('orders.read');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $locId = $this->currentLocationId($u);

        // Status counts
        $this->db->query("SELECT status, COUNT(*) AS cnt FROM repair_orders WHERE location_id = :location_id GROUP BY status");
        $this->db->bind(':location_id', $locId);
        $rows = $this->db->resultSet();
        $byStatus = [];
        foreach ($rows as $r) {
            $byStatus[(string)$r->status] = (int)$r->cnt;
        }

        // Completed today
        $this->db->query("
            SELECT COUNT(*) AS cnt
            FROM repair_orders
            WHERE status = 'Completed'
              AND location_id = :location_id
              AND DATE(updated_at) = CURDATE()
        ");
        $this->db->bind(':location_id', $locId);
        $obj = $this->db->single();
        $completedToday = $obj ? (int)$obj->cnt : 0;

        // Avg repair time (hours) for completed orders over last 30 days (created_at -> updated_at)
        $this->db->query("
            SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, updated_at)) AS avg_min
            FROM repair_orders
            WHERE status = 'Completed'
              AND location_id = :location_id
              AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ");
        $this->db->bind(':location_id', $locId);
        $avgObj = $this->db->single();
        $avgMinutes = ($avgObj && $avgObj->avg_min !== null) ? (float)$avgObj->avg_min : 0.0;
        $avgRepairHours = $avgMinutes > 0 ? round($avgMinutes / 60.0, 1) : 0.0;

        // Throughput (last 7 days): received (created) and completed (updated_at where status completed)
        $this->db->query("
            SELECT DATE(created_at) AS d, COUNT(*) AS received
            FROM repair_orders
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
              AND location_id = :location_id
            GROUP BY DATE(created_at)
        ");
        $this->db->bind(':location_id', $locId);
        $receivedRows = $this->db->resultSet() ?: [];
        $receivedMap = [];
        foreach ($receivedRows as $r) {
            $receivedMap[(string)$r->d] = (int)$r->received;
        }

        $this->db->query("
            SELECT DATE(updated_at) AS d, COUNT(*) AS completed
            FROM repair_orders
            WHERE status = 'Completed'
              AND updated_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
              AND location_id = :location_id
            GROUP BY DATE(updated_at)
        ");
        $this->db->bind(':location_id', $locId);
        $completedRows = $this->db->resultSet() ?: [];
        $completedMap = [];
        foreach ($completedRows as $r) {
            $completedMap[(string)$r->d] = (int)$r->completed;
        }

        $series = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} day"));
            $series[] = [
                'date' => $d,
                'received' => $receivedMap[$d] ?? 0,
                'completed' => $completedMap[$d] ?? 0,
            ];
        }

        // Urgent attention list (non-completed, urgent/high/emergency)
        $this->db->query("
            SELECT id, vehicle_model, priority, status, expected_time, created_at
            FROM repair_orders
            WHERE status <> 'Completed'
              AND location_id = :location_id
              AND priority IN ('Urgent','High','Emergency')
            ORDER BY
              CASE WHEN expected_time IS NULL THEN 1 ELSE 0 END,
              expected_time ASC,
              created_at DESC
            LIMIT 5
        ");
        $this->db->bind(':location_id', $locId);
        $urgentRows = $this->db->resultSet() ?: [];
        $urgent = array_map(function($r) {
            return [
                'id' => (int)$r->id,
                'vehicle_model' => (string)$r->vehicle_model,
                'priority' => (string)$r->priority,
                'status' => (string)$r->status,
                'expected_time' => $r->expected_time ? (string)$r->expected_time : null,
                'created_at' => (string)$r->created_at,
            ];
        }, $urgentRows);

        // Recent completions
        $this->db->query("
            SELECT id, vehicle_model, updated_at
            FROM repair_orders
            WHERE status = 'Completed'
              AND location_id = :location_id
            ORDER BY updated_at DESC
            LIMIT 6
        ");
        $this->db->bind(':location_id', $locId);
        $recentRows = $this->db->resultSet() ?: [];
        $recent = array_map(function($r) {
            return [
                'id' => (int)$r->id,
                'vehicle_model' => (string)$r->vehicle_model,
                'completed_at' => (string)$r->updated_at,
            ];
        }, $recentRows);

        // Service bays utilization
        $this->db->query("SELECT status, COUNT(*) AS cnt FROM service_bays WHERE location_id = :location_id GROUP BY status");
        $this->db->bind(':location_id', $locId);
        $bayRows = $this->db->resultSet() ?: [];
        $baysByStatus = [];
        $bayTotal = 0;
        foreach ($bayRows as $r) {
            $baysByStatus[(string)$r->status] = (int)$r->cnt;
            $bayTotal += (int)$r->cnt;
        }

        $this->success([
            'ordersByStatus' => $byStatus,
            'completedToday' => $completedToday,
            'avgRepairHours' => $avgRepairHours,
            'throughputLast7Days' => $series,
            'urgentAttention' => $urgent,
            'recentCompletions' => $recent,
            'serviceBaysByStatus' => $baysByStatus,
            'serviceBaysTotal' => $bayTotal,
        ]);
    }
}
