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

    /** Tables the AI may read (same list the schema endpoint describes). */
    const AI_TABLES = [
        'invoices', 'invoice_items', 'customers', 'parts',
        'stock_movements', 'acc_expenses', 'repair_orders',
        'inventory_batches', 'payment_receipts',
    ];
    const AI_MAX_ROWS = 200;

    /**
     * Checks AI-written SQL and returns why it's rejected, or null when it's acceptable.
     * Belt and braces: the query also runs in a READ ONLY transaction, so MySQL itself
     * refuses any write that slipped through.
     */
    private function rejectSql(string $sql): ?string {
        if ($sql === '') return 'No SQL query provided.';
        if (preg_match('/;|--|\/\*|#/', $sql)) return 'Only a single SELECT statement is allowed (no ; or comments).';
        if (!preg_match('/^\s*(SELECT|WITH)\b/i', $sql)) return 'Only SELECT queries are allowed.';

        $forbidden = 'INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|RENAME|GRANT|REVOKE|REPLACE|CREATE|CALL|DO|HANDLER|LOAD|LOCK|UNLOCK|SET|INTO|OUTFILE|DUMPFILE|LOAD_FILE|SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK|INFORMATION_SCHEMA|PERFORMANCE_SCHEMA|MYSQL|SYS';
        if (preg_match('/\b(' . $forbidden . ')\b/i', $sql, $m)) return 'Forbidden keyword: ' . strtoupper($m[1]);

        // Every table after FROM / JOIN must be on the allow-list (CTE names are allowed too).
        preg_match_all('/\bWITH\s+`?(\w+)`?\s+AS\b|,\s*`?(\w+)`?\s+AS\s*\(/i', $sql, $cte);
        $ctes = array_map('strtolower', array_filter(array_merge($cte[1], $cte[2])));
        preg_match_all('/\b(?:FROM|JOIN)\s+`?(\w+)`?(?:\s*\.\s*`?(\w+)`?)?/i', $sql, $t, PREG_SET_ORDER);
        foreach ($t as $hit) {
            if (!empty($hit[2])) return 'Database-qualified table names are not allowed.';
            $name = strtolower($hit[1]);
            if ($name === 'select' || $name === '(') continue; // sub-query
            if (!in_array($name, self::AI_TABLES, true) && !in_array($name, $ctes, true)) {
                return "Table `$name` is not available to the assistant.";
            }
        }
        return null;
    }

    /** Runs a vetted SELECT read-only and returns at most AI_MAX_ROWS rows. */
    private function runReadOnly(string $sql): array {
        $pdo = $this->db->getDb();
        $pdo->exec('START TRANSACTION READ ONLY');
        try {
            $stmt = $pdo->query($sql);
            $rows = [];
            while (count($rows) < self::AI_MAX_ROWS && ($r = $stmt->fetch(PDO::FETCH_ASSOC))) $rows[] = $r;
            return $rows;
        } finally {
            $pdo->exec('ROLLBACK');
        }
    }

    /**
     * POST /api/intelligence/query { sql }
     * Runs one read-only SELECT against the allowed tables.
     */
    public function query() {
        @ini_set('display_errors', 0);
        $this->requirePermission('reports.read');
        $json = json_decode(file_get_contents('php://input'), true) ?: [];
        $sql = trim((string)($json['sql'] ?? ''));
        if ($why = $this->rejectSql($sql)) { $this->error($why, 403); return; }
        try {
            $this->success($this->runReadOnly($sql));
        } catch (Throwable $e) {
            $this->error($e->getMessage(), 422);
        }
    }

    /** Up to 4 columns of numbers or short text: safe to format without the model. */
    private function isSimpleRow(array $row): bool {
        if (count($row) > 4) return false;
        foreach ($row as $v) if (is_string($v) && !is_numeric($v) && strlen($v) > 60) return false;
        return true;
    }

    /** Markdown for a single-row result: "**Label:** value" per column, money as LKR. */
    private function formatSimple(array $row): string {
        if (!$row) return 'No matching records were found for this period or filter.';
        $lines = [];
        $empty = true;
        foreach ($row as $col => $v) {
            $label = ucfirst(trim(str_replace('_', ' ', (string)$col)));
            $money = (bool)preg_match('/revenue|total|amount|sales|paid|cost|expense|balance|value|price|profit|due|income/i', (string)$col);
            if ($v === null || $v === '') {
                $shown = $money ? 'LKR 0.00' : '0';
            } elseif (is_numeric($v)) {
                $f = (float)$v;
                if ($f != 0.0) $empty = false;
                $shown = $money ? 'LKR ' . number_format($f, 2) : (floor($f) == $f ? number_format($f) : number_format($f, 2));
            } else {
                $empty = false;
                $shown = (string)$v;
            }
            $lines[] = "**$label:** $shown";
        }
        $out = implode("  \n", $lines);
        return $empty ? $out . "\n\nNo matching records were found for this period or filter." : $out;
    }

    /** Reads and validates { question } from the request body; null (after replying) when invalid. */
    private function readQuestion(): ?string {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $q = trim((string)($body['question'] ?? ''));
        if ($q === '') { $this->error('Ask a question first.', 422); return null; }
        if (mb_strlen($q) > 2000) { $this->error('Question is too long (2000 characters max).', 422); return null; }
        return $q;
    }

    /**
     * Business Intelligence pipeline. The configured model writes a plan + SELECT, the server
     * runs it read-only (feeding errors back up to 3 times), then either formats a simple
     * result itself or asks the model to summarise. $emit(stage, data) reports progress:
     *   thinking {text} · plan {steps[]} · lookup {text} · retry {text} · found {rows} · writing {text}
     * Returns the final payload. The SQL never leaves this function.
     */
    private function runAsk(string $question, callable $emit): array {
        require_once __DIR__ . '/../helpers/AiClient.php';
        require_once __DIR__ . '/../core/SchemaDefinition.php';
        $full = SchemaDefinition::get();
        $schema = [];
        foreach (self::AI_TABLES as $t) if (isset($full[$t])) $schema[$t] = array_keys($full[$t]['columns']);

        $cfg = AiConfig::active();
        $model = $cfg['provider'] . ' · ' . $cfg['model'];

        $sqlSystem = "You write one MySQL SELECT query that answers a business question about this ERP's data.\n"
            . "Use only these tables and columns:\n" . json_encode($schema) . "\n\n"
            . "Rules: a single SELECT (or WITH ... SELECT) statement; no semicolons, comments, or writes; "
            . "backtick identifiers; prefer aggregates and LIMIT 50 for lists; today is " . date('Y-m-d') . ". "
            . "Money is in LKR. The question may be in English, Sinhala or Singlish.\n\n"
            . "Reply in exactly this format:\n"
            . "METHOD:\n- <step in plain business words, in the question's language, no SQL or column names, e.g. 'Add up all invoices issued in October 2026, leaving out cancelled ones'>\n- <next step, if any>\n"
            . "SQL: <the query>";

        $emit('thinking', ['text' => 'Understanding the question and planning the lookup', 'model' => $model]);

        $history = [['role' => 'user', 'content' => $question]];
        $thoughts = ''; $rows = null; $lastError = '';
        for ($attempt = 0; $attempt < 4; $attempt++) {
            $out = AiClient::chat($sqlSystem, $history);
            $thoughts = preg_match('/METHOD:\s*([\s\S]*?)\bSQL:/i', $out, $m) ? trim($m[1]) : '';
            $sql = preg_match('/\bSQL:\s*([\s\S]*)$/i', $out, $m) ? $m[1] : $out;
            $sql = rtrim(trim(preg_replace(['/```(?:sql)?/i', '/^\*+|\*+$/'], '', $sql)), "; \n\r\t");

            if ($attempt === 0) $emit('plan', ['steps' => $this->steps($thoughts)]);
            $emit('lookup', ['text' => $attempt === 0 ? 'Looking up your data' : 'Trying the corrected lookup']);

            $err = $this->rejectSql($sql);
            if (!$err) {
                try { $rows = $this->runReadOnly($sql); break; }
                catch (Throwable $e) { $err = $e->getMessage(); }
            }
            $lastError = $err;
            if ($attempt < 3) $emit('retry', ['text' => 'That lookup didn\'t work; fixing it and trying again']);
            $history[] = ['role' => 'assistant', 'content' => $out];
            $history[] = ['role' => 'user', 'content' => "That query failed: $err\nFix it using only the tables and columns given, and reply in the same format."];
        }
        $method = $this->steps($thoughts);
        if ($rows !== null) $emit('found', ['rows' => count($rows)]);

        // Fast path: one row of a few plain values (a total, a count) needs no second model call.
        if (is_array($rows) && count($rows) <= 1 && $this->isSimpleRow($rows[0] ?? [])) {
            return ['answer' => $this->formatSimple($rows[0] ?? []), 'method' => $method,
                    'rows' => count($rows), 'retryCount' => $attempt, 'model' => $model];
        }

        $emit('writing', ['text' => 'Writing the answer']);
        $data = $rows === null
            ? "The query could not be run ($lastError)."
            : (count($rows) ? json_encode($rows) : 'The query ran and returned no rows.');
        $answer = AiClient::chat(
            "You are BizFlow AI, a business analyst inside an ERP. Answer the user's question from the query results only, briefly, "
            . "in the same language as the question (English, Sinhala or Singlish). "
            . "If there are no results, say plainly that no matching records were found for that period or filter; do not guess why "
            . "(no talk of syncing, closed periods or system errors). Use Markdown: a one-line answer first, then a table for lists, "
            . "bold key figures, LKR for money. If the results compare 2+ numeric categories, end with a chart block:\n"
            . "```chart\n{\"type\":\"bar\",\"title\":\"Title (LKR)\",\"data\":[{\"name\":\"A\",\"value\":100}]}\n```\n"
            . "Valid types: bar, line, pie.",
            [['role' => 'user', 'content' => "Question: $question\n\nQuery results:\n$data"]]
        );
        return ['answer' => $answer, 'method' => $method, 'rows' => $rows === null ? null : count($rows),
                'retryCount' => $attempt, 'model' => $model];
    }

    private function steps(string $thoughts): array {
        return array_values(array_filter(array_map(fn($l) => trim(ltrim(trim($l), "-*• ")), preg_split('/\r?\n/', $thoughts))));
    }

    /**
     * POST /api/intelligence/ask { question }  → one JSON reply when done.
     * The caller needs reports.read; the API key stays on the server.
     */
    public function ask() {
        @ini_set('display_errors', 0);
        @set_time_limit(300);
        $this->requirePermission('reports.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        if (($q = $this->readQuestion()) === null) return;
        try {
            $this->success($this->runAsk($q, fn() => null));
        } catch (RuntimeException $e) {
            $this->error($e->getMessage(), 502);
        }
    }

    /**
     * POST /api/intelligence/ask_stream { question }  → text/event-stream.
     * Same as ask(), but sends each step as it happens ("event: <stage>"), then
     * "event: done" with the answer, or "event: error".
     */
    public function ask_stream() {
        @ini_set('display_errors', 0);
        @set_time_limit(300);
        $this->requirePermission('reports.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        if (($q = $this->readQuestion()) === null) return;

        // Unbuffered event stream (also tells nginx/Apache proxies not to buffer).
        @ini_set('zlib.output_compression', '0');
        @ini_set('output_buffering', '0');
        if (function_exists('apache_setenv')) @apache_setenv('no-gzip', '1');
        while (ob_get_level() > 0) @ob_end_clean();
        header('Content-Type: text/event-stream; charset=utf-8');
        header('Cache-Control: no-cache, no-transform');
        header('X-Accel-Buffering: no');

        $send = function (string $event, array $data) {
            echo "event: $event\ndata: " . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
            @flush();
        };
        echo ':' . str_repeat(' ', 2048) . "\n\n"; // pad so the first event isn't held back
        @flush();
        try {
            $send('done', $this->runAsk($q, $send));
        } catch (Throwable $e) {
            $send('error', ['message' => $e instanceof RuntimeException ? $e->getMessage() : 'Something went wrong while answering.']);
        }
        exit;
    }
}
