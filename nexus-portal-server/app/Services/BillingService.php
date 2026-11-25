<?php
namespace App\Services;

use App\Core\Database;
use App\Core\Mailer;
use App\Models\SaaSInvoiceModel;

/**
 * Subscription billing rules in one place.
 *
 *  - Who is billed: Active tenants on a paid plan. Trial, Suspended and Deleted tenants and free
 *    plans are skipped, with the reason shown in the preview.
 *  - Monthly plans: one invoice per calendar month ("November 2026").
 *  - Yearly plans: one invoice per year ("Annual 2026 - 2027"); the next one is due 12 months
 *    after the last annual invoice, never on every run.
 *  - Amount: the plan's USD price converted with the active exchange rate, fixed on the invoice.
 *  - Payments may be partial. An invoice becomes Paid only when its payments cover the amount;
 *    deleting a payment recalculates the status. Unpaid invoices past their due date become Overdue.
 */
class BillingService {
    const DUE_DAYS = 10;
    const CENT = 0.005;

    private static function db() { return new Database(); }

    /** Pending invoices past their due date become Overdue (and back, if a due date moves later). */
    public static function syncOverdue() {
        $db = self::db();
        $db->query("UPDATE saas_invoices SET status = 'Overdue' WHERE status = 'Pending' AND due_date IS NOT NULL AND due_date < CURDATE()");
        $db->execute();
        $db->query("UPDATE saas_invoices SET status = 'Pending' WHERE status = 'Overdue' AND (due_date IS NULL OR due_date >= CURDATE())");
        $db->execute();
    }

    /** Sum of payments recorded against an invoice. */
    public static function paidTotal($invoiceId) {
        $db = self::db();
        $db->query("SELECT COALESCE(SUM(amount), 0) AS paid FROM saas_payments WHERE invoice_id = :id");
        $db->bind(':id', (int)$invoiceId);
        return (float)$db->single()->paid;
    }

    /** Set Paid / Pending / Overdue from the payments. Cancelled stays Cancelled. */
    public static function recalcStatus($invoiceId) {
        $db = self::db();
        $db->query("SELECT amount, due_date, status FROM saas_invoices WHERE id = :id");
        $db->bind(':id', (int)$invoiceId);
        $inv = $db->single();
        if (!$inv || $inv->status === 'Cancelled') return $inv->status ?? null;
        $paid = self::paidTotal($invoiceId);
        if ($paid + self::CENT >= (float)$inv->amount) $status = 'Paid';
        elseif ($inv->due_date && $inv->due_date < date('Y-m-d')) $status = 'Overdue';
        else $status = 'Pending';
        if ($status !== $inv->status) (new SaaSInvoiceModel())->update($invoiceId, ['status' => $status]);
        return $status;
    }

    private static function exchange() {
        $rates = ExchangeRateService::getRates();
        $db = self::db();
        $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'exchange_rate_source'");
        $row = $db->single();
        return [$rates, $row->setting_value ?? 'Market'];
    }

    /** "November 2026" from "November 2026"; null if it is not a month name and year. */
    public static function normalizePeriod($period) {
        $period = trim((string)$period);
        if ($period === '') return date('F Y');
        $t = \DateTime::createFromFormat('!F Y', $period);
        return $t ? $t->format('F Y') : null;
    }

    /**
     * What a billing run for $period would do, tenant by tenant. Nothing is written.
     * Each row: tenant_id, name, status, package, cycle, base_usd, currency, rate, amount, billing_month, action ('bill'|'skip'), reason.
     */
    public static function preview($period, $onlyTenantId = null) {
        $period = self::normalizePeriod($period);
        if (!$period) throw new \InvalidArgumentException('Choose a month and year.');
        [$rates, $source] = self::exchange();

        $db = self::db();
        $db->query("SELECT t.id, t.name, t.status, t.currency, t.billing_cycle, t.admin_email, t.created_at,
                           p.name AS package_name, p.monthly_price, p.yearly_price
                    FROM saas_tenants t LEFT JOIN saas_packages p ON p.id = t.package_id"
                    . ($onlyTenantId ? " WHERE t.id = :tid" : " WHERE t.status <> 'Deleted'") . " ORDER BY t.name");
        if ($onlyTenantId) $db->bind(':tid', (int)$onlyTenantId);
        $tenants = $db->resultSet();

        $periodStart = \DateTime::createFromFormat('!F Y', $period);
        $rows = [];
        foreach ($tenants as $t) {
            $yearly = ($t->billing_cycle === 'yearly');
            $monthly = (float)($t->monthly_price ?? 0);
            $base = $yearly ? ((float)($t->yearly_price ?? 0) > 0 ? (float)$t->yearly_price : round($monthly * 12 * 0.80, 2)) : $monthly;
            $currency = $t->currency ?: 'USD';
            $rate = $currency === 'USD' ? 1.0 : (float)($rates[$currency] ?? 0);
            $label = $yearly ? 'Annual ' . $periodStart->format('Y') . ' - ' . ((int)$periodStart->format('Y') + 1) : $period;

            $row = [
                'tenant_id' => (int)$t->id, 'name' => $t->name, 'status' => $t->status, 'admin_email' => $t->admin_email,
                'package' => $t->package_name ?: null, 'cycle' => $yearly ? 'yearly' : 'monthly',
                'base_usd' => $base, 'currency' => $currency, 'rate' => $rate, 'source' => $source,
                'amount' => $rate > 0 ? round($base * $rate, 2) : null, 'billing_month' => $label,
                'action' => 'bill', 'reason' => null,
            ];

            if ($t->status !== 'Active') { $row['action'] = 'skip'; $row['reason'] = $t->status === 'Trial' ? 'On trial' : $t->status; }
            elseif (!$t->package_name) { $row['action'] = 'skip'; $row['reason'] = 'No plan'; }
            elseif ($base <= 0) { $row['action'] = 'skip'; $row['reason'] = 'Free plan'; }
            elseif ($rate <= 0) { $row['action'] = 'skip'; $row['reason'] = "No exchange rate for $currency"; }
            elseif ($yearly) {
                $db->query("SELECT invoice_number, created_at FROM saas_invoices WHERE tenant_id = :tid AND billing_month LIKE 'Annual%' AND status <> 'Cancelled' ORDER BY created_at DESC LIMIT 1");
                $db->bind(':tid', (int)$t->id);
                $last = $db->single();
                if ($last && strtotime($last->created_at . ' +12 months') > $periodStart->modify('last day of this month')->getTimestamp()) {
                    $row['action'] = 'skip';
                    $row['reason'] = 'Annual plan invoiced (' . $last->invoice_number . '), next due ' . date('F Y', strtotime($last->created_at . ' +12 months'));
                }
                $periodStart = \DateTime::createFromFormat('!F Y', $period);
            } else {
                $db->query("SELECT invoice_number FROM saas_invoices WHERE tenant_id = :tid AND billing_month = :m AND status <> 'Cancelled' LIMIT 1");
                $db->bind(':tid', (int)$t->id);
                $db->bind(':m', $label);
                if ($ex = $db->single()) { $row['action'] = 'skip'; $row['reason'] = 'Already invoiced (' . $ex->invoice_number . ')'; }
            }
            $rows[] = $row;
        }
        return ['period' => $period, 'due_date' => date('Y-m-d', strtotime('+' . self::DUE_DAYS . ' days')), 'tenants' => $rows];
    }

    /**
     * Create and email invoices for $period, only for the given tenants and only where the preview
     * still says 'bill' (so a second click or a stale screen never double-bills).
     */
    public static function generate($period, array $tenantIds) {
        @set_time_limit(0);
        $want = array_flip(array_map('intval', $tenantIds));
        $preview = self::preview($period);
        $results = [];
        foreach ($preview['tenants'] as $row) {
            if (!isset($want[$row['tenant_id']])) continue;
            if ($row['action'] !== 'bill') { $results[] = ['tenant_id' => $row['tenant_id'], 'name' => $row['name'], 'status' => 'Skipped', 'reason' => $row['reason']]; continue; }
            try {
                $inv = self::createInvoice($row, $preview['due_date']);
                $results[] = ['tenant_id' => $row['tenant_id'], 'name' => $row['name'], 'status' => 'Generated',
                    'invoice_number' => $inv['invoice_number'], 'amount' => $row['amount'], 'currency' => $row['currency'], 'email' => $inv['email']];
            } catch (\Throwable $e) {
                error_log('Billing: ' . $row['name'] . ': ' . $e->getMessage());
                $results[] = ['tenant_id' => $row['tenant_id'], 'name' => $row['name'], 'status' => 'Error', 'reason' => $e->getMessage()];
            }
        }
        return ['period' => $preview['period'], 'results' => $results];
    }

    /** Insert one invoice (number taken from its own id, so it can never repeat), then email it. */
    private static function createInvoice(array $row, $dueDate) {
        $model = new SaaSInvoiceModel();
        $id = $model->create([
            'tenant_id' => $row['tenant_id'], 'invoice_number' => 'TMP-' . bin2hex(random_bytes(6)),
            'amount' => $row['amount'], 'currency' => $row['currency'], 'exchange_rate' => $row['rate'], 'source' => $row['source'],
            'billing_month' => $row['billing_month'], 'due_date' => $dueDate, 'status' => 'Pending',
        ]);
        if (!$id) throw new \RuntimeException('Could not save the invoice.');
        $number = 'INV-' . date('Ym') . '-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
        $model->update($id, ['invoice_number' => $number]);
        return ['invoice_number' => $number, 'email' => self::emailInvoice($id, false)];
    }

    /** Email an invoice (or a payment reminder). Returns 'Sent' or 'Failed'. */
    public static function emailInvoice($id, $reminder) {
        $model = new SaaSInvoiceModel();
        $inv = $model->getFullDetail($id);
        if (!$inv) throw new \InvalidArgumentException('Invoice not found');
        $subject = "New Invoice #{$inv->invoice_number} for {$inv->billing_month} - {$inv->tenant_name}";
        if ($reminder) {
            $db = self::db();
            $db->query("SELECT COUNT(*) AS n FROM saas_email_logs WHERE invoice_id = :id AND email_type = 'Invoice' AND status = 'Resent'");
            $db->bind(':id', (int)$id);
            $n = (int)$db->single()->n;
            $subject = ($n === 0 ? '[Payment Reminder] ' : ($n === 1 ? '[2nd Reminder] Action required: ' : '[Final Notice] '))
                . "Invoice #{$inv->invoice_number} - {$inv->tenant_name}";
        }
        $sent = false; $error = null;
        try {
            $pdf = InvoicePDF::generate($inv, false);
            $desc = ($inv->package_name ?: 'Subscription') . (strpos((string)$inv->billing_month, 'Annual') === 0 ? ' (Annual Subscription)' : ' (Monthly Subscription)');
            $sent = Mailer::sendInvoiceEmail($inv->admin_email, $inv->tenant_name, $inv->invoice_number, $pdf, $inv->billing_month,
                $inv->balance, $inv->currency, $inv->billing_cc_email, $reminder ? $subject : $desc);
        } catch (\Throwable $e) { $error = $e->getMessage(); error_log('Invoice email: ' . $error); }
        $status = $sent ? ($reminder ? 'Resent' : 'Sent') : 'Failed';
        $model->update($id, ['email_status' => $status, 'last_sent_at' => date('Y-m-d H:i:s')]);
        $model->logEmail($id, 'Invoice', $inv->admin_email, $inv->billing_cc_email, $status, $error, $subject, Mailer::$lastBody);
        return $sent ? 'Sent' : 'Failed';
    }

    /** Record a payment (full or partial), recalculate the status and email the receipt. */
    public static function recordPayment($invoiceId, $amount, $method, $reference) {
        $model = new SaaSInvoiceModel();
        $inv = $model->getFullDetail($invoiceId);
        if (!$inv) throw new \InvalidArgumentException('Invoice not found');
        if ($inv->status === 'Cancelled') throw new \InvalidArgumentException('This invoice is cancelled.');
        $balance = (float)$inv->balance;
        if ($balance <= self::CENT) throw new \InvalidArgumentException('This invoice is already paid in full.');
        $amount = round((float)$amount, 2);
        if ($amount <= 0) throw new \InvalidArgumentException('Enter an amount greater than zero.');
        if ($amount > $balance + self::CENT) throw new \InvalidArgumentException('The amount is more than the balance (' . number_format($balance, 2) . ').');
        if ($method === 'Check') $method = 'Cheque';
        $methods = ['Bank Transfer', 'Cash', 'Cheque', 'Card', 'Online'];
        if (!in_array($method, $methods, true)) $method = 'Bank Transfer';
        $reference = mb_substr(trim((string)$reference), 0, 100);

        $db = self::db();
        $db->query("INSERT INTO saas_payments (invoice_id, receipt_number, amount, payment_method, transaction_id) VALUES (:iid, :rn, :amt, :pm, :tid)");
        $db->bind(':iid', (int)$invoiceId);
        $db->bind(':rn', 'TMP-' . bin2hex(random_bytes(6)));
        $db->bind(':amt', $amount);
        $db->bind(':pm', $method);
        $db->bind(':tid', $reference);
        $db->execute();
        $pid = (int)$db->lastInsertId();
        $receipt = 'RCP-' . date('Ymd') . '-' . str_pad((string)$pid, 5, '0', STR_PAD_LEFT);
        $db->query("UPDATE saas_payments SET receipt_number = :rn WHERE id = :id");
        $db->bind(':rn', $receipt);
        $db->bind(':id', $pid);
        $db->execute();

        $status = self::recalcStatus($invoiceId);
        $email = self::emailReceipt($invoiceId, $pid);
        return ['receipt_number' => $receipt, 'status' => $status, 'balance' => max(0, round($balance - $amount, 2)), 'email' => $email];
    }

    /** Email the receipt for one payment (default: the latest). */
    public static function emailReceipt($invoiceId, $paymentId = null) {
        $model = new SaaSInvoiceModel();
        $inv = $model->getFullDetail($invoiceId, $paymentId);
        if (!$inv || !$inv->receipt_number) throw new \InvalidArgumentException('This invoice has no payment to send a receipt for.');
        $sent = false; $error = null;
        try {
            $receiptPdf = InvoicePDF::generate($inv, true);
            $invoicePdf = InvoicePDF::generate($inv, false);
            $sent = Mailer::sendPaymentReceipt($inv->admin_email, $inv->tenant_name, $inv->invoice_number, $receiptPdf, $invoicePdf,
                $inv->payment_amount, $inv->currency, $inv->receipt_number, $inv->billing_cc_email);
        } catch (\Throwable $e) { $error = $e->getMessage(); error_log('Receipt email: ' . $error); }
        $subject = "Payment Receipt {$inv->receipt_number} for Invoice #{$inv->invoice_number} - {$inv->tenant_name}";
        $model->update($invoiceId, ['email_status' => $sent ? 'Sent' : 'Failed', 'last_sent_at' => date('Y-m-d H:i:s')]);
        $model->logEmail($invoiceId, 'Receipt', $inv->admin_email, $inv->billing_cc_email, $sent ? 'Sent' : 'Failed', $error, $subject, Mailer::$lastBody);
        return $sent ? 'Sent' : 'Failed';
    }
}
