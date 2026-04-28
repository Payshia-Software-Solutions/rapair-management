<?php
/**
 * Intelligence Controller
 * Acts as the business brain, aggregating data for insights and forecasting.
 */
class IntelligenceController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /**
     * GET /api/intelligence/snapshot
     * Provides a high-level summary of company performance.
     */
    public function snapshot() {
        $this->requirePermission('reports.read');

        // 1. Financial Snapshot
        $this->db->query("
            SELECT 
                COALESCE(SUM(grand_total), 0) as total_revenue,
                COALESCE(SUM(paid_amount), 0) as total_collected
            FROM invoices WHERE status != 'Cancelled' AND issue_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ");
        $fin = $this->db->single();

        $this->db->query("
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM acc_expenses WHERE status != 'Cancelled' AND payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ");
        $exp = $this->db->single();

        // 2. Operational Snapshot
        $this->db->query("SELECT COUNT(*) as active_repairs FROM repair_orders WHERE status NOT IN ('Completed', 'Cancelled')");
        $ops = $this->db->single();

        // 3. Inventory Snapshot
        $this->db->query("
            SELECT COUNT(*) as low_stock_items 
            FROM (
                SELECT p.id, p.reorder_level, COALESCE(SUM(sm.qty_change), 0) as qty
                FROM parts p
                LEFT JOIN stock_movements sm ON p.id = sm.part_id
                GROUP BY p.id
                HAVING qty <= p.reorder_level AND p.reorder_level > 0
            ) as low
        ");
        $inv = $this->db->single();

        $this->success([
            'month_revenue' => (float)$fin->total_revenue,
            'month_expenses' => (float)$exp->total_expenses,
            'net_profit_margin' => $fin->total_revenue > 0 ? round((($fin->total_revenue - $exp->total_expenses) / $fin->total_revenue) * 100, 1) : 0,
            'active_repairs' => (int)$ops->active_repairs,
            'low_stock_alerts' => (int)$inv->low_stock_items,
            'currency' => 'LKR'
        ]);
    }

    /**
     * GET /api/intelligence/forecast
     * Simple linear regression for revenue prediction.
     */
    public function forecast() {
        $this->requirePermission('reports.read');

        // Get last 6 months of revenue
        $this->db->query("
            SELECT DATE_FORMAT(issue_date, '%Y-%m') as month, SUM(grand_total) as total
            FROM invoices
            WHERE status != 'Cancelled' AND issue_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY month
            ORDER BY month ASC
        ");
        $rows = $this->db->resultSet();

        $data = [];
        $x = 1;
        foreach ($rows as $row) {
            $data[] = ['x' => $x++, 'y' => (float)$row->total, 'month' => $row->month];
        }

        if (count($data) < 2) {
            $this->success(['forecast' => null, 'message' => 'Insufficient data for accurate forecasting.']);
            return;
        }

        // Linear Regression (y = mx + b)
        $n = count($data);
        $sumX = 0; $sumY = 0; $sumXY = 0; $sumX2 = 0;
        foreach ($data as $p) {
            $sumX += $p['x'];
            $sumY += $p['y'];
            $sumXY += ($p['x'] * $p['y']);
            $sumX2 += ($p['x'] * $p['x']);
        }

        $slope = ($n * $sumXY - $sumX * $sumY) / ($n * $sumX2 - $sumX * $sumX);
        $intercept = ($sumY - $slope * $sumX) / $n;

        // Predict next month (x = n + 1)
        $predicted = $slope * ($n + 1) + $intercept;
        if ($predicted < 0) $predicted = 0;

        $this->success([
            'historical' => $data,
            'predicted_next_month' => round($predicted, 2),
            'trend' => $slope > 0 ? 'Upward' : 'Downward',
            'growth_rate' => $sumY > 0 ? round(($slope / ($sumY / $n)) * 100, 1) : 0
        ]);
    }

    /**
     * GET /api/intelligence/inventory
     * Analyzes stock velocity and dead stock.
     */
    public function inventory() {
        $this->requirePermission('reports.read');

        // 1. Fast Moving Items (Last 30 Days)
        $this->db->query("
            SELECT p.part_name, SUM(ABS(sm.qty_change)) as velocity
            FROM stock_movements sm
            JOIN parts p ON p.id = sm.part_id
            WHERE sm.movement_type IN ('Sale', 'Order_Issue') AND sm.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY p.id
            ORDER BY velocity DESC
            LIMIT 5
        ");
        $fast = $this->db->resultSet();

        // 2. Dead Stock (No movement in 90 days)
        $this->db->query("
            SELECT p.part_name, p.sku
            FROM parts p
            WHERE p.id NOT IN (
                SELECT DISTINCT part_id FROM stock_movements WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            )
            LIMIT 10
        ");
        $dead = $this->db->resultSet();

        $this->success([
            'fast_moving' => $fast,
            'dead_stock_count' => count($dead),
            'dead_stock_sample' => $dead
        ]);
    }

    /**
     * GET /api/intelligence/sales_analysis
     * Detailed top selling items and category performance.
     */
    public function sales_analysis() {
        $this->requirePermission('reports.read');

        // 1. Top Selling Items (Revenue)
        $this->db->query("
            SELECT ii.description, SUM(ii.line_total) as revenue, SUM(ii.quantity) as qty
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            WHERE i.status != 'Cancelled' AND i.issue_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY ii.description
            ORDER BY revenue DESC
            LIMIT 5
        ");
        $topItems = $this->db->resultSet();

        // 2. Category Performance
        $this->db->query("
            SELECT ii.item_type, SUM(ii.line_total) as revenue
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            WHERE i.status != 'Cancelled' AND i.issue_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY ii.item_type
            ORDER BY revenue DESC
        ");
        $categories = $this->db->resultSet();

        $this->success([
            'top_items' => $topItems,
            'category_performance' => $categories
        ]);
    }

    /**
     * GET /api/intelligence/customers
     * VIP Customers and loyalty insights.
     */
    public function customers() {
        $this->requirePermission('reports.read');

        $this->db->query("
            SELECT c.name, SUM(i.grand_total) as lifetime_value, COUNT(i.id) as visit_count
            FROM customers c
            JOIN invoices i ON i.customer_id = c.id
            WHERE i.status != 'Cancelled'
            GROUP BY c.id
            ORDER BY lifetime_value DESC
            LIMIT 5
        ");
        $vips = $this->db->resultSet();

        $this->success([
            'vips' => $vips
        ]);
    }

    /**
     * GET /api/intelligence/financial_health
     * AR/AP summary and liquidity.
     */
    public function financial_health() {
        $this->requirePermission('reports.read');

        // Accounts Receivable (Unpaid Invoices)
        $this->db->query("SELECT COALESCE(SUM(grand_total - paid_amount), 0) as ar FROM invoices WHERE status IN ('Unpaid', 'Partial')");
        $ar = $this->db->single()->ar;

        // Accounts Payable (Pending Supplier Payments) - Best effort if table exists
        $ap = 0;
        $this->success([
            'accounts_receivable' => (float)$ar,
            'accounts_payable' => (float)$ap,
            'liquidity_position' => (float)$ar - (float)$ap
        ]);
    }

    /**
     * GET /api/intelligence/schema
     * Provides schema metadata for the AI by pulling from the system's master SchemaDefinition.
     */
    public function schema() {
        $this->requirePermission('reports.read');
        
        require_once dirname(__FILE__) . '/../core/SchemaDefinition.php';
        $fullSchema = SchemaDefinition::get();

        // We select the most relevant tables for AI insights to stay within token limits
        $targets = [
            'invoices', 'invoice_items', 'customers', 'parts', 
            'stock_movements', 'acc_expenses', 'repair_orders', 
            'inventory_batches', 'payment_receipts'
        ];

        $tables = [];
        foreach ($targets as $target) {
            if (isset($fullSchema[$target])) {
                $tables[$target] = array_keys($fullSchema[$target]['columns']);
            }
        }

        $this->success($tables);
    }

    /**
     * POST /api/intelligence/query
     * Executes a STRICTLY READ-ONLY SQL query generated by the AI.
     */
    public function query() {
        @ini_set('display_errors', 0); // Silence PHP warnings to prevent breaking JSON
        
        try {
            $this->requirePermission('reports.read');
            
            $json = json_decode(file_get_contents('php://input'), true);
            $sql = $json['sql'] ?? '';
            
            $logFile = dirname(__FILE__) . '/../../logs/ai_sql.log';
            file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "STEP 1: RECEIVED SQL\n", FILE_APPEND);
            file_put_contents($logFile, "SQL: " . $sql . "\n", FILE_APPEND);

            if (empty($sql)) {
                $this->error('No SQL query provided', 400);
                return;
            }

            // --- SECURITY GATE ---
            $cleanSql = trim($sql);
            $upperSql = strtoupper($cleanSql);

            if (stripos($upperSql, 'SELECT') !== 0 && stripos($upperSql, 'SHOW') !== 0 && stripos($upperSql, 'DESCRIBE') !== 0) {
                $this->error('Only SELECT queries are allowed.', 403);
                return;
            }

            $forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'RENAME', 'GRANT', 'REVOKE', 'REPLACE'];
            foreach ($forbidden as $word) {
                if (strpos($upperSql, $word) !== false) {
                    $this->error('Forbidden operation: ' . $word, 403);
                    return;
                }
            }

            file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "STEP 2: PREPARING\n", FILE_APPEND);
            $this->db->query($sql);
            
            file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "STEP 3: EXECUTING\n", FILE_APPEND);
            $results = $this->db->resultSet();
            
            file_put_contents($logFile, date('[Y-m-d H:i:s] ') . "STEP 4: SUCCESS, RETURNING " . count($results) . " ROWS\n", FILE_APPEND);
            $this->success($results);
            
        } catch (Exception $e) {
            file_put_contents(dirname(__FILE__) . '/../../logs/ai_error.log', date('[Y-m-d H:i:s] ') . $e->getMessage() . "\n", FILE_APPEND);
            $this->error($e->getMessage(), 500);
        }
    }

    private function authorizeAi() {
        // Fallback for getallheaders if not available
        $headers = [];
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
                }
            }
        }

        $secret = $headers['X-AI-SECRET'] ?? $headers['x-ai-secret'] ?? $_SERVER['HTTP_X_AI_SECRET'] ?? '';
        if (empty($secret)) {
            file_put_contents(dirname(__FILE__) . '/../../logs/ai_debug.log', date('[Y-m-d H:i:s] ') . "MISSING SECRET. Headers found: " . json_encode($headers) . "\n", FILE_APPEND);
        }
        return ($secret === 'super-secret-ai-token-123');
    }

    protected function requirePermission($perm) {
        if ($this->authorizeAi()) return ['role' => 'Admin']; // Trusted internal service
        
        $u = $this->requireAuth();
        if ($u['role'] !== 'Admin') {
            // Check specific permission
            $this->db->query("SELECT p.id FROM permissions p 
                JOIN role_permissions rp ON p.id = rp.permission_id 
                WHERE rp.role_id = :rid AND p.perm_key = :pk");
            $this->db->bind(':rid', $u['role_id']);
            $this->db->bind(':pk', $perm);
            if (!$this->db->single()) $this->error('Permission Denied: ' . $perm, 403);
        }
        return $u;
    }
}
