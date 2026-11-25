<?php
/**
 * Cancellation requests: a user asks to cancel a document (with a reason); a DIFFERENT user with
 * the "cancellations.approve" permission (or an Admin) approves it, and only then is it cancelled.
 *
 * Types: Invoice, PaymentReceipt, GRN, Expense, VendorPayment, Reservation.
 */
class CancellationRequestHelper {
    const TYPES = ['Invoice', 'PaymentReceipt', 'GRN', 'Expense', 'VendorPayment', 'Reservation'];

    /** [number, amount, location_id, status] of a document, or null. */
    public static function docInfo($db, $type, $id) {
        $sql = [
            'Invoice'        => "SELECT invoice_no AS no, grand_total AS amount, location_id AS loc, status FROM invoices WHERE id = :id",
            'PaymentReceipt' => "SELECT receipt_no AS no, amount, location_id AS loc, status FROM payment_receipts WHERE id = :id",
            'GRN'            => "SELECT grn_number AS no, total_amount AS amount, location_id AS loc, status FROM goods_receive_notes WHERE id = :id",
            'Expense'        => "SELECT voucher_no AS no, amount, NULL AS loc, status FROM acc_expenses WHERE id = :id",
            'VendorPayment'  => "SELECT reference_no AS no, amount, NULL AS loc, status FROM acc_supplier_payments WHERE id = :id",
            'Reservation'    => "SELECT reservation_no AS no, total_amount AS amount, NULL AS loc, status FROM hotel_reservations WHERE id = :id",
        ][$type] ?? null;
        if (!$sql) return null;
        try { $db->query($sql); $db->bind(':id', (int)$id); return $db->single() ?: null; } catch (Exception $e) { return null; }
    }

    /** Why this document can't be cancelled now, or null. */
    public static function blocker($db, $type, $id) {
        $info = self::docInfo($db, $type, $id);
        if (!$info) return 'Document not found';
        if (strtolower((string)$info->status) === 'cancelled') return 'Already cancelled';
        if ($type === 'Invoice') {
            require_once __DIR__ . '/../models/Invoice.php';
            return (new Invoice())->cancelBlocker($id);
        }
        return null;
    }

    /** Create a request. Returns [ok(bool), message, requestId]. */
    public static function create($db, $type, $id, $reason, $userId) {
        $reason = trim(mb_substr((string)$reason, 0, 500));
        if (!in_array($type, self::TYPES, true)) return [false, 'Unknown document type', null];
        if (mb_strlen($reason) < 5) return [false, 'Please give a reason (at least 5 characters)', null];
        $block = self::blocker($db, $type, $id);
        if ($block) return [false, $block, null];
        $db->query("SELECT id FROM cancellation_requests WHERE doc_type = :t AND doc_id = :d AND status = 'pending' LIMIT 1");
        $db->bind(':t', $type); $db->bind(':d', (int)$id);
        if ($db->single()) return [false, 'A cancellation request for this document is already waiting for approval', null];
        $info = self::docInfo($db, $type, $id);
        $db->query("INSERT INTO cancellation_requests (doc_type, doc_id, doc_no, amount, location_id, reason, requested_by)
                    VALUES (:t, :d, :no, :amt, :loc, :r, :u)");
        $db->bind(':t', $type); $db->bind(':d', (int)$id); $db->bind(':no', $info->no); $db->bind(':amt', $info->amount);
        $db->bind(':loc', $info->loc); $db->bind(':r', $reason); $db->bind(':u', (int)$userId);
        $db->execute();
        return [true, 'Cancellation requested. Another user must approve it.', (int)$db->lastInsertId()];
    }

    /** Run the actual cancellation. Returns [ok, message]. */
    public static function execute($type, $id, $reason, $userId) {
        $map = [
            'Invoice' => 'Invoice', 'PaymentReceipt' => 'PaymentReceipt', 'GRN' => 'GoodsReceiveNote',
            'Expense' => 'Expense', 'VendorPayment' => 'SupplierPayment', 'Reservation' => 'Reservation',
        ];
        $cls = $map[$type] ?? null;
        if (!$cls) return [false, 'Unknown document type'];
        require_once __DIR__ . '/../models/' . $cls . '.php';
        $model = new $cls();
        if ($type === 'GRN') {
            // GRN cancel needs the GRN's own location (stock is reversed there)
            $info = self::docInfo(new Database(), 'GRN', $id);
            $ok = $model->cancel($id, $reason, $userId, (int)($info->loc ?? 1) ?: 1);
        } else {
            $ok = $model->cancel($id, $reason, $userId);
        }
        if ($ok && $type === 'Invoice') {
            // Loyalty: take back earned points, give back redeemed points
            require_once __DIR__ . '/LoyaltyHelper.php';
            LoyaltyHelper::reverseInvoice(new Database(), (int)$id, (int)$userId);
            // Promotion usage limit: the use comes back
            require_once __DIR__ . '/../models/Promotion.php';
            (new Promotion())->releaseUse((int)$id, new Database());
        }
        if ($ok && $type === 'PaymentReceipt') {
            // A gift-voucher payment goes back onto the voucher
            require_once __DIR__ . '/GiftVoucherHelper.php';
            GiftVoucherHelper::restoreForReceipt(new Database(), (int)$id, (int)$userId);
        }
        if ($ok) return [true, 'Document cancelled'];
        return [false, property_exists($model, 'lastError') && $model->lastError ? $model->lastError : 'Cancellation failed'];
    }
}
