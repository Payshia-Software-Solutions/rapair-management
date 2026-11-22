<?php
/**
 * Posting check: finds business documents that never reached the accounts and posts them.
 *   GET  /api/posting/unposted          -> groups with counts, amounts and rows
 *   POST /api/posting/post { type, ids? } -> posts those (or all of that type); idempotent
 */
require_once '../app/helpers/AccountingHelper.php';
require_once '../app/models/Journal.php';
require_once '../app/models/Account.php';

class PostingController extends Controller {
    private $db;

    private const LABELS = [
        'Invoice' => 'Sales invoices',
        'PaymentReceipt' => 'Customer payments',
        'Refund' => 'Refunds',
        'SalesReturn' => 'Sales returns',
        'GRN' => 'Goods received (GRN)',
        'SupplierPayment' => 'Supplier payments',
        'Expense' => 'Expense vouchers',
        'StockAdjustment' => 'Stock adjustments',
        'StockMovement' => 'Manual stock changes & opening stock',
        'Reclass' => 'Older entries to move to the new accounts (taxes, discounts, returns, stock)',
    ];

    public function __construct() {
        $this->db = new Database();
    }

    /** SQL returning id, doc_no, doc_date, amount for each unposted document of a type. */
    private function sqlFor($type) {
        // Own alias: reusing `e` here shadowed the outer `e` in the Reclass query, so posted entries kept showing.
        $no = fn($t, $id) => "NOT EXISTS (SELECT 1 FROM acc_journal_entries posted_chk WHERE posted_chk.ref_type = '$t' AND posted_chk.ref_id = $id)";
        switch ($type) {
            case 'Invoice': return "SELECT i.id, i.invoice_no AS doc_no, i.issue_date AS doc_date, i.grand_total AS amount
                FROM invoices i WHERE LOWER(COALESCE(i.status,'')) <> 'cancelled' AND " . $no('Invoice', 'i.id');
            case 'PaymentReceipt': return "SELECT p.id, p.receipt_no AS doc_no, p.payment_date AS doc_date, p.amount
                FROM payment_receipts p JOIN invoices i ON i.id = p.invoice_id
                WHERE COALESCE(p.status,'') <> 'Cancelled' AND LOWER(COALESCE(i.status,'')) <> 'cancelled' AND " . $no('PaymentReceipt', 'p.id') . "
                AND NOT EXISTS (SELECT 1 FROM acc_journal_entries e WHERE e.ref_type = 'Payment' AND e.ref_id = p.invoice_id)";
            case 'Refund': return "SELECT r.id, r.refund_no AS doc_no, r.refund_date AS doc_date, r.amount FROM refunds r WHERE " . $no('Refund', 'r.id');
            case 'SalesReturn': return "SELECT s.id, s.return_no AS doc_no, s.return_date AS doc_date, s.total_amount AS amount
                FROM sales_returns s WHERE LOWER(COALESCE(s.status,'')) <> 'cancelled' AND " . $no('SalesReturn', 's.id');
            case 'GRN': return "SELECT g.id, g.grn_number AS doc_no, DATE(g.received_at) AS doc_date, g.total_amount AS amount
                FROM goods_receive_notes g WHERE LOWER(COALESCE(g.status,'')) <> 'cancelled' AND " . $no('GRN', 'g.id');
            case 'SupplierPayment': return "SELECT s.id, CONCAT('SP-', s.id) AS doc_no, s.payment_date AS doc_date, s.amount
                FROM acc_supplier_payments s WHERE LOWER(COALESCE(s.status,'')) <> 'cancelled' AND " . $no('SupplierPayment', 's.id');
            case 'Expense': return "SELECT x.id, x.voucher_no AS doc_no, x.payment_date AS doc_date, x.amount
                FROM acc_expenses x WHERE LOWER(COALESCE(x.status,'')) NOT IN ('cancelled','pending') AND " . $no('Expense', 'x.id');
            case 'StockAdjustment': return "SELECT a.id, a.adjustment_number AS doc_no, DATE(a.adjusted_at) AS doc_date,
                (SELECT COALESCE(SUM(m.qty_change * COALESCE(m.unit_cost,0)),0) FROM stock_movements m WHERE m.ref_table = 'stock_adjustments' AND m.ref_id = a.id) AS amount
                FROM stock_adjustments a WHERE LOWER(COALESCE(a.status,'')) IN ('approved','completed','posted') AND " . $no('Adjustment', 'a.id');
            case 'StockMovement': return "SELECT m.id, CONCAT(IF(m.ref_table = 'import','Opening stock: ','Adjust: '), COALESCE(p.part_name, m.part_id)) AS doc_no,
                DATE(m.created_at) AS doc_date, ROUND(m.qty_change * COALESCE(NULLIF(m.unit_cost,0), p.cost_price, 0), 2) AS amount
                FROM stock_movements m LEFT JOIN parts p ON p.id = m.part_id
                WHERE m.movement_type = 'ADJUSTMENT' AND m.ref_table IN ('parts','import')
                AND ABS(m.qty_change * COALESCE(NULLIF(m.unit_cost,0), p.cost_price, 0)) >= 0.01 AND " . $no('StockMovement', 'm.id');
            case 'Reclass': return "SELECT e.id, e.description AS doc_no, e.entry_date AS doc_date, e.total_amount AS amount
                FROM acc_journal_entries e
                WHERE e.ref_type IN ('Invoice','SalesReturn','StockMovement','Adjustment') AND e.description NOT LIKE 'REVERSAL:%'
                AND NOT EXISTS (SELECT 1 FROM acc_journal_items r WHERE r.notes = CONCAT('Reversal of entry #', e.id))
                AND " . $no('Reclass', 'e.id');
        }
        return null;
    }

    /** Rows of a type; Reclass rows are kept only when something actually needs moving. */
    private function rowsFor($type, $limit = null) {
        $this->db->query($this->sqlFor($type) . " ORDER BY doc_date ASC, id ASC" . ($limit ? " LIMIT $limit" : ''));
        $rows = $this->db->resultSet() ?: [];
        if ($type !== 'Reclass') return $rows;
        $out = [];
        foreach ($rows as $r) {
            $moves = AccountingHelper::reclassMoves($r->id);
            if (!$moves) continue;
            $r->amount = round(array_sum(array_map(fn($m) => abs($m[2]), $moves)), 2);
            $out[] = $r;
        }
        return $out;
    }

    public function unposted() {
        $this->requirePermission('accounting.read');
        $groups = [];
        foreach (array_keys(self::LABELS) as $type) {
            try {
                $rows = $this->rowsFor($type, $type === 'Reclass' ? null : 500);
            } catch (Exception $e) {
                $rows = []; // table not used on this install
            }
            $groups[] = [
                'type' => $type, 'label' => self::LABELS[$type], 'count' => count($rows),
                'amount' => round(array_sum(array_map(fn($r) => (float)$r->amount, $rows)), 2),
                'rows' => $rows,
            ];
        }
        // Books check: debits must equal credits
        $this->db->query("SELECT COALESCE(SUM(debit),0) d, COALESCE(SUM(credit),0) c FROM acc_journal_items");
        $t = $this->db->single();
        $this->success([
            'groups' => $groups,
            'total' => array_sum(array_column($groups, 'count')),
            'balanced' => abs((float)$t->d - (float)$t->c) < 0.01,
        ]);
    }

    private function postOne($type, $id) {
        switch ($type) {
            case 'Invoice':
                require_once '../app/models/Invoice.php';
                return AccountingHelper::postInvoice($id);
            case 'PaymentReceipt':
                require_once '../app/models/PaymentReceipt.php';
                $this->db->query("SELECT * FROM payment_receipts WHERE id = :id");
                $this->db->bind(':id', $id);
                $r = $this->db->single();
                return $r ? (new PaymentReceipt())->postJournal($id, (array)$r) : false;
            case 'Refund':
                return AccountingHelper::postRefund($id);
            case 'SalesReturn':
                $this->db->query("SELECT * FROM sales_returns WHERE id = :id");
                $this->db->bind(':id', $id);
                $r = $this->db->single();
                return $r ? AccountingHelper::postSalesReturn($id, [
                    'total_amount' => $r->total_amount, 'customer_id' => $r->customer_id,
                    'return_date' => $r->return_date, 'userId' => $r->created_by,
                ]) : false;
            case 'GRN':
                return AccountingHelper::postGRN($id);
            case 'SupplierPayment':
                $this->db->query("SELECT * FROM acc_supplier_payments WHERE id = :id");
                $this->db->bind(':id', $id);
                $r = $this->db->single();
                return $r ? AccountingHelper::postSupplierPayment($id, (array)$r + ['userId' => $r->created_by]) : false;
            case 'Expense':
                $this->db->query("SELECT * FROM acc_expenses WHERE id = :id");
                $this->db->bind(':id', $id);
                $r = $this->db->single();
                return $r ? AccountingHelper::postExpenseVoucher($id, (array)$r + ['userId' => $r->created_by]) : false;
            case 'StockAdjustment':
                return AccountingHelper::postStockAdjustment($id);
            case 'StockMovement':
                return AccountingHelper::postStockMovement($id);
            case 'Reclass':
                return AccountingHelper::postReclass($id);
        }
        return false;
    }

    public function post() {
        $u = $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method not allowed', 405); return; }
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $type = (string)($body['type'] ?? '');
        if (!isset(self::LABELS[$type])) { $this->error('Unknown document type', 422); return; }

        $ids = array_map(fn($r) => (int)$r->id, $this->rowsFor($type));
        if (!empty($body['ids']) && is_array($body['ids'])) $ids = array_values(array_intersect($ids, array_map('intval', $body['ids'])));

        $ok = 0; $failed = [];
        foreach ($ids as $id) {
            try { if ($this->postOne($type, $id)) $ok++; else $failed[] = $id; }
            catch (Throwable $e) { error_log("Posting $type #$id failed: " . $e->getMessage()); $failed[] = $id; }
        }
        $msg = "$ok posted" . ($failed ? ', ' . count($failed) . " couldn't be posted (check account mappings or closed periods)" : '');
        $this->success(['posted' => $ok, 'failed' => $failed], $msg);
    }
}
