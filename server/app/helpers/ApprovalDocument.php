<?php
/**
 * The document behind an approval or cancellation request, in one shape the mobile app renders:
 *   [
 *     'title'  => 'Purchase order PO-0012',
 *     'fields' => [['label' => 'Supplier', 'value' => 'ABC Traders'], ...],
 *     'lines'  => [['name' => 'Brake pad', 'qty' => 2, 'price' => 1500.0, 'total' => 3000.0, 'note' => null], ...],
 *     'line_columns' => ['Qty', 'Price', 'Total'],   // what qty/price/total mean for this document
 *     'totals' => [['label' => 'Grand total', 'value' => 3000.0], ...],
 *     'impact' => ['payments' => [...], 'stock' => [...], 'journals' => [...], 'blocker' => ?string],  // cancellations of invoices only
 *   ]
 * Returns null when the type has no stored document (e.g. stock adjustments keep theirs in the request payload).
 * Read-only. Used by ApprovalController::document().
 */
class ApprovalDocument {

    /** Approval workflow types (approval_requests.doc_type). */
    public static function forApproval(string $type, int $docId) {
        switch ($type) {
            case 'purchase_order':    return self::purchaseOrder($docId);
            case 'expense':           return self::expense($docId);
            case 'stock_count':       return self::stockCount($docId);
            case 'stock_requisition': return self::requisition($docId);
            case 'discount':          return self::invoice($docId);
            case 'cancellation':      return self::forCancellationRequest($docId);
            default:                  return null;
        }
    }

    /** A cancellation_requests row: the document it wants to cancel, plus the request's reason. */
    public static function forCancellationRequest(int $requestId) {
        $db = new Database();
        $db->query("SELECT doc_type, doc_id, reason FROM cancellation_requests WHERE id = :id");
        $db->bind(':id', $requestId);
        $r = $db->single();
        if (!$r) return null;
        $doc = self::forCancellable((string)$r->doc_type, (int)$r->doc_id);
        if ($doc) array_unshift($doc['fields'], ['label' => 'Cancellation reason', 'value' => (string)$r->reason]);
        if ($doc && $r->doc_type === 'Invoice') $doc['impact'] = self::invoiceImpact((int)$r->doc_id);
        return $doc;
    }

    /** Types CancellationRequestHelper can cancel. */
    public static function forCancellable(string $type, int $id) {
        switch ($type) {
            case 'Invoice':        return self::invoice($id);
            case 'GRN':            return self::grn($id);
            case 'Expense':        return self::expense($id);
            case 'PaymentReceipt': return self::paymentReceipt($id);
            case 'VendorPayment':  return self::vendorPayment($id);
            case 'Reservation':    return self::reservation($id);
            default:               return null;
        }
    }

    // ---------------------------------------------------------------- documents

    private static function invoice(int $id) {
        $h = self::row("SELECT i.*, c.name AS customer_name, c.phone AS customer_phone, sl.name AS location_name
                        FROM invoices i LEFT JOIN customers c ON c.id = i.customer_id
                        LEFT JOIN service_locations sl ON sl.id = i.location_id WHERE i.id = :id", $id);
        if (!$h) return null;
        $lines = array_map(fn($l) => [
            'name' => (string)$l->description, 'qty' => (float)$l->quantity, 'price' => (float)$l->unit_price,
            'total' => (float)$l->line_total, 'note' => (float)$l->discount > 0 ? 'Discount ' . self::n($l->discount) : ($l->item_notes ?: null),
        ], self::rows("SELECT description, quantity, unit_price, discount, line_total, item_notes FROM invoice_items WHERE invoice_id = :id ORDER BY id", $id));
        return [
            'title' => 'Invoice ' . $h->invoice_no,
            'fields' => self::fields([
                'Customer' => $h->customer_name ?: 'Walk-in',
                'Phone' => $h->customer_phone,
                'Date' => $h->issue_date,
                'Location' => $h->location_name,
                'Status' => $h->status,
                'Paid' => self::money($h->paid_amount),
                'Notes' => $h->notes,
            ]),
            'lines' => $lines,
            'line_columns' => ['Qty', 'Price', 'Total'],
            'totals' => self::totals([
                'Subtotal' => $h->subtotal, 'Discount' => $h->discount_total, 'Tax' => $h->tax_total,
                'Grand total' => $h->grand_total,
            ]),
        ];
    }

    private static function purchaseOrder(int $id) {
        $h = self::row("SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone, sl.name AS location_name, u.name AS created_by_name
                        FROM purchase_orders po LEFT JOIN suppliers s ON s.id = po.supplier_id
                        LEFT JOIN service_locations sl ON sl.id = po.location_id
                        LEFT JOIN users u ON u.id = po.created_by WHERE po.id = :id", $id);
        if (!$h) return null;
        $rows = self::rows("SELECT p.part_name, p.unit, i.qty_ordered, i.unit_cost, i.line_total FROM purchase_order_items i
                            LEFT JOIN parts p ON p.id = i.part_id WHERE i.purchase_order_id = :id ORDER BY i.id", $id);
        $total = 0.0;
        $lines = array_map(function ($l) use (&$total) {
            $t = $l->line_total !== null ? (float)$l->line_total : (float)$l->qty_ordered * (float)$l->unit_cost;
            $total += $t;
            return ['name' => (string)($l->part_name ?: 'Item'), 'qty' => (float)$l->qty_ordered, 'price' => (float)$l->unit_cost, 'total' => $t, 'note' => $l->unit ?: null];
        }, $rows);
        return [
            'title' => 'Purchase order ' . $h->po_number,
            'fields' => self::fields([
                'Supplier' => $h->supplier_name, 'Phone' => $h->supplier_phone, 'Location' => $h->location_name,
                'Ordered' => $h->ordered_at, 'Expected' => $h->expected_at, 'Created by' => $h->created_by_name, 'Notes' => $h->notes,
            ]),
            'lines' => $lines,
            'line_columns' => ['Qty', 'Unit cost', 'Total'],
            'totals' => self::totals(['Total' => $total]),
        ];
    }

    private static function grn(int $id) {
        $h = self::row("SELECT g.*, s.name AS supplier_name, sl.name AS location_name, po.po_number
                        FROM goods_receive_notes g LEFT JOIN suppliers s ON s.id = g.supplier_id
                        LEFT JOIN service_locations sl ON sl.id = g.location_id
                        LEFT JOIN purchase_orders po ON po.id = g.purchase_order_id WHERE g.id = :id", $id);
        if (!$h) return null;
        $lines = array_map(fn($l) => [
            'name' => (string)($l->part_name ?: 'Item'), 'qty' => (float)$l->qty_received, 'price' => (float)$l->unit_cost,
            'total' => $l->line_total !== null ? (float)$l->line_total : (float)$l->qty_received * (float)$l->unit_cost,
            'note' => $l->batch_number ? 'Batch ' . $l->batch_number : null,
        ], self::rows("SELECT p.part_name, i.qty_received, i.unit_cost, i.line_total, i.batch_number FROM grn_items i
                       LEFT JOIN parts p ON p.id = i.part_id WHERE i.grn_id = :id ORDER BY i.id", $id));
        return [
            'title' => 'GRN ' . $h->grn_number,
            'fields' => self::fields([
                'Supplier' => $h->supplier_name, 'Purchase order' => $h->po_number, 'Received' => $h->received_at,
                'Location' => $h->location_name, 'Status' => $h->status, 'Notes' => $h->notes,
            ]),
            'lines' => $lines,
            'line_columns' => ['Qty', 'Unit cost', 'Total'],
            'totals' => self::totals(['Subtotal' => $h->subtotal, 'Tax' => $h->tax_total, 'Total' => $h->total_amount]),
        ];
    }

    private static function expense(int $id) {
        $h = self::row("SELECT * FROM acc_expenses WHERE id = :id", $id);
        if (!$h) return null;
        $v = (array)$h;
        return [
            'title' => 'Expense voucher ' . ($v['voucher_no'] ?? '#' . $id),
            'fields' => self::fields([
                'Payee' => $v['payee_name'] ?? null,
                'Date' => $v['payment_date'] ?? null,
                'Method' => $v['payment_method'] ?? null,
                'Reference' => $v['reference_no'] ?? null,
                'Status' => $v['status'] ?? null,
                'Notes' => $v['notes'] ?? ($v['description'] ?? null),
            ]),
            'lines' => [],
            'line_columns' => [],
            'totals' => self::totals(['Amount' => $v['amount'] ?? null]),
        ];
    }

    private static function stockCount(int $id) {
        $h = self::row("SELECT sc.*, sl.name AS location_name FROM stock_counts sc
                        LEFT JOIN service_locations sl ON sl.id = sc.location_id WHERE sc.id = :id", $id);
        if (!$h) return null;
        $lines = array_map(fn($l) => [
            'name' => (string)($l->part_name ?: 'Item'), 'qty' => (float)$l->system_stock, 'price' => (float)$l->physical_stock,
            'total' => (float)$l->variance, 'note' => $l->notes ?: null,
        ], self::rows("SELECT p.part_name, i.system_stock, i.physical_stock, i.variance, i.notes FROM stock_count_items i
                       LEFT JOIN parts p ON p.id = i.part_id WHERE i.stock_count_id = :id ORDER BY i.id", $id));
        return [
            'title' => 'Stock count ' . $h->count_number,
            'fields' => self::fields([
                'Location' => $h->location_name, 'Counted' => $h->counted_at, 'Reason' => $h->reason, 'Notes' => $h->notes,
            ]),
            'lines' => $lines,
            'line_columns' => ['System', 'Counted', 'Variance'],
            'totals' => [],
        ];
    }

    private static function requisition(int $id) {
        $h = self::row("SELECT r.*, f.name AS from_name, t.name AS to_name, u.name AS created_by_name
                        FROM stock_transfer_requisitions r
                        LEFT JOIN service_locations f ON f.id = r.from_location_id
                        LEFT JOIN service_locations t ON t.id = r.to_location_id
                        LEFT JOIN users u ON u.id = r.created_by WHERE r.id = :id", $id);
        if (!$h) return null;
        $lines = array_map(fn($l) => [
            'name' => (string)($l->part_name ?: 'Item'), 'qty' => (float)$l->qty_requested, 'price' => null, 'total' => null,
            'note' => $l->notes ?: ($l->unit ?: null),
        ], self::rows("SELECT p.part_name, p.unit, i.qty_requested, i.notes FROM stock_transfer_requisition_items i
                       LEFT JOIN parts p ON p.id = i.part_id WHERE i.requisition_id = :id ORDER BY i.id", $id));
        return [
            'title' => 'Stock request ' . $h->requisition_number,
            'fields' => self::fields([
                'From' => $h->from_name, 'To' => $h->to_name, 'Requested' => $h->requested_at,
                'Requested by' => $h->created_by_name, 'Notes' => $h->notes,
            ]),
            'lines' => $lines,
            'line_columns' => ['Qty'],
            'totals' => [],
        ];
    }

    private static function paymentReceipt(int $id) {
        $h = self::row("SELECT p.*, COALESCE(c.name, p.customer_name) AS cust FROM payment_receipts p
                        LEFT JOIN customers c ON c.id = p.customer_id WHERE p.id = :id", $id);
        if (!$h) return null;
        return [
            'title' => 'Payment receipt ' . $h->receipt_no,
            'fields' => self::fields([
                'Customer' => $h->cust, 'Invoice' => $h->invoice_no, 'Date' => $h->payment_date,
                'Method' => $h->payment_method, 'Reference' => $h->reference_no, 'Status' => $h->status, 'Notes' => $h->notes,
            ]),
            'lines' => [],
            'line_columns' => [],
            'totals' => self::totals(['Amount' => $h->amount]),
        ];
    }

    private static function vendorPayment(int $id) {
        $h = self::row("SELECT p.*, s.name AS supplier_name FROM acc_supplier_payments p
                        LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = :id", $id);
        if (!$h) return null;
        $v = (array)$h;
        return [
            'title' => 'Vendor payment ' . ($v['reference_no'] ?? '#' . $id),
            'fields' => self::fields([
                'Supplier' => $v['supplier_name'] ?? null, 'Date' => $v['payment_date'] ?? null,
                'Method' => $v['payment_method'] ?? null, 'Status' => $v['status'] ?? null, 'Notes' => $v['notes'] ?? null,
            ]),
            'lines' => [],
            'line_columns' => [],
            'totals' => self::totals(['Amount' => $v['amount'] ?? null]),
        ];
    }

    private static function reservation(int $id) {
        $h = self::row("SELECT r.*, c.name AS customer_name, c.phone AS customer_phone FROM hotel_reservations r
                        LEFT JOIN customers c ON c.id = r.customer_id WHERE r.id = :id", $id);
        if (!$h) return null;
        $v = (array)$h;
        return [
            'title' => 'Reservation ' . ($v['reservation_no'] ?? '#' . $id),
            'fields' => self::fields([
                'Guest' => $v['customer_name'] ?? null, 'Phone' => $v['customer_phone'] ?? null,
                'Check-in' => $v['check_in'] ?? null, 'Check-out' => $v['check_out'] ?? null,
                'Status' => $v['status'] ?? null, 'Notes' => $v['notes'] ?? null,
            ]),
            'lines' => [],
            'line_columns' => [],
            'totals' => self::totals(['Total' => $v['total_amount'] ?? null]),
        ];
    }

    /** Same data as CancellationController::invoiceImpact (the web "What gets reversed" panel). */
    private static function invoiceImpact(int $id): array {
        $db = new Database();
        $out = ['payments' => [], 'stock' => [], 'journals' => [], 'blocker' => null];
        $db->query("SELECT id, receipt_no, payment_method, amount, payment_date, status FROM payment_receipts WHERE invoice_id = :id ORDER BY id");
        $db->bind(':id', $id);
        $out['payments'] = $db->resultSet() ?: [];
        $db->query("SELECT sm.id, sm.qty_change, sm.movement_type, sm.unit_cost, p.part_name, p.unit, sl.name AS location_name, b.batch_number
                    FROM stock_movements sm LEFT JOIN parts p ON p.id = sm.part_id
                    LEFT JOIN service_locations sl ON sl.id = sm.location_id
                    LEFT JOIN inventory_batches b ON b.id = sm.batch_id
                    WHERE sm.ref_table = 'invoices' AND sm.ref_id = :id ORDER BY sm.id");
        $db->bind(':id', $id);
        $out['stock'] = $db->resultSet() ?: [];
        $receiptIds = array_map(fn($p) => (int)$p->id, $out['payments']);
        $refs = "(ref_type IN ('Invoice','Payment') AND ref_id = " . $id . ")";
        if ($receiptIds) $refs .= " OR (ref_type = 'PaymentReceipt' AND ref_id IN (" . implode(',', $receiptIds) . "))";
        $db->query("SELECT id, entry_date, description, ref_type, total_amount FROM acc_journal_entries WHERE $refs ORDER BY id");
        $out['journals'] = $db->resultSet() ?: [];
        foreach ($out['journals'] as $j) {
            $db->query("SELECT a.code AS account_code, a.name AS account_name, i.debit, i.credit
                        FROM acc_journal_items i JOIN acc_accounts a ON a.id = i.account_id
                        WHERE i.entry_id = :e ORDER BY i.debit DESC, i.id ASC");
            $db->bind(':e', $j->id);
            $j->lines = $db->resultSet() ?: [];
        }
        require_once APPROOT . '/app/models/Invoice.php';
        $b = (new Invoice())->cancelBlocker($id);
        if ($b && stripos($b, 'already cancelled') === false) $out['blocker'] = $b;
        return $out;
    }

    // ---------------------------------------------------------------- helpers

    private static function row(string $sql, int $id) {
        $db = new Database();
        $db->query($sql);
        $db->bind(':id', $id);
        return $db->single() ?: null;
    }

    private static function rows(string $sql, int $id): array {
        $db = new Database();
        $db->query($sql);
        $db->bind(':id', $id);
        return $db->resultSet() ?: [];
    }

    /** Drops empty values, keeps order. */
    private static function fields(array $kv): array {
        $out = [];
        foreach ($kv as $k => $v) {
            if ($v === null || trim((string)$v) === '') continue;
            $out[] = ['label' => $k, 'value' => (string)$v];
        }
        return $out;
    }

    /** Numeric totals; zero discount/tax rows are dropped, the last (main) total always stays. */
    private static function totals(array $kv): array {
        $out = [];
        $keys = array_keys($kv);
        foreach ($kv as $k => $v) {
            if ($v === null) continue;
            if ((float)$v == 0.0 && $k !== end($keys)) continue;
            $out[] = ['label' => $k, 'value' => (float)$v];
        }
        return $out;
    }

    private static function money($v) { return $v === null ? null : 'LKR ' . number_format((float)$v, 2); }
    private static function n($v) { return number_format((float)$v, 2); }
}
