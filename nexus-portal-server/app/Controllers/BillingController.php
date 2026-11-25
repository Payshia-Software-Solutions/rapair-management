<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Database;
use App\Models\SaaSInvoiceModel;
use App\Services\BillingService;
use App\Services\InvoicePDF;

/**
 * Subscription invoices and payments. Rules live in BillingService.
 *
 *   GET  api/admin/billing/preview?period=November 2026      who a run would bill, and why others are skipped
 *   POST api/admin/billing/generate {period, tenant_ids[]}  create + email those invoices (re-checked server side)
 *   POST api/admin/billing/run-cycle?tenant_id=&period=     same rules, one tenant (kept for old screens)
 *   GET  api/admin/billing/list                              all invoices with paid and balance
 *   POST api/admin/billing/update {id, ...}                  amount / due date / period / status (Pending, Overdue, Cancelled)
 *   POST api/admin/billing/delete?id=                        only invoices without payments
 *   POST api/admin/billing/pay {invoice_id, amount, payment_method, transaction_id}   full or partial
 *   GET  api/admin/billing/payments?id= | payments/all,  POST payments/delete?id=
 *   GET  api/admin/billing/resend?id=&type=invoice|receipt
 *   GET  api/admin/billing/download?id=&type=invoice|receipt   (clients: own invoices only)
 *   GET  api/client/billing/history
 */
class BillingController extends Controller {

    private function checkAuth() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
        return true;
    }

    private function checkLogin() {
        if (!isset($_SESSION['admin_id'])) {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
        return true;
    }

    private function fail(\Throwable $e) {
        $bad = $e instanceof \InvalidArgumentException;
        if (!$bad) error_log('Billing: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        return $this->json(['status' => 'error', 'message' => $bad ? $e->getMessage() : 'Something went wrong: ' . $e->getMessage()], $bad ? 400 : 500);
    }

    private function body() {
        return $this->getPostData() ?: [];
    }

    public function preview() {
        $this->checkAuth();
        try { return $this->json(['status' => 'success', 'data' => BillingService::preview($_GET['period'] ?? '')]); }
        catch (\Throwable $e) { return $this->fail($e); }
    }

    public function generate() {
        $this->checkAuth();
        $d = $this->body();
        $ids = array_values(array_filter(array_map('intval', (array)($d['tenant_ids'] ?? []))));
        if (!$ids) return $this->json(['status' => 'error', 'message' => 'Select at least one tenant.'], 400);
        try {
            $r = BillingService::generate($d['period'] ?? '', $ids);
            $n = count(array_filter($r['results'], fn($x) => $x['status'] === 'Generated'));
            return $this->json(['status' => 'success', 'message' => "Generated $n invoice" . ($n === 1 ? '' : 's'), 'data' => $r]);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    /** One tenant, same rules as generate (no more billing trial or deleted tenants by id). */
    public function runBillingCycle() {
        $this->checkAuth();
        $tid = (int)($_GET['tenant_id'] ?? 0);
        if (!$tid) return $this->json(['status' => 'error', 'message' => 'Use Run Billing to review and bill several tenants.'], 400);
        try {
            $r = BillingService::generate($_GET['period'] ?? '', [$tid]);
            $row = $r['results'][0] ?? null;
            if (!$row) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);
            return $this->json(['status' => 'success', 'message' => $row['status'] . (!empty($row['reason']) ? ': ' . $row['reason'] : ''),
                'processed' => $row['status'] === 'Generated' ? 1 : 0, 'data' => $row]);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function getMyHistory() {
        $this->checkLogin();
        if (empty($_SESSION['tenant_id'])) return $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        BillingService::syncOverdue();
        return $this->json(['status' => 'success', 'data' => (new SaaSInvoiceModel())->getByTenant($_SESSION['tenant_id'])]);
    }

    public function listAll() {
        $this->checkAuth();
        BillingService::syncOverdue();
        return $this->json(['status' => 'success', 'data' => (new SaaSInvoiceModel())->getAllWithTenants()]);
    }

    public function download() {
        $this->checkLogin();
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);

        $type = $_GET['type'] ?? null;
        $paymentId = isset($_GET['payment_id']) ? (int)$_GET['payment_id'] : null;
        $invoice = (new SaaSInvoiceModel())->getFullDetail($id, $paymentId);
        if (!$invoice) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);

        // Clients can only download their own
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin' && (int)$invoice->tenant_id !== (int)($_SESSION['tenant_id'] ?? 0)) {
            return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

        $isReceipt = $type === 'receipt' || (!$type && $invoice->status === 'Paid');
        if ($isReceipt && !$invoice->receipt_number) return $this->json(['status' => 'error', 'message' => 'No payment recorded for this invoice'], 404);

        try { $pdf = InvoicePDF::generate($invoice, $isReceipt); }
        catch (\Throwable $e) { return $this->fail($e); }

        $name = $isReceipt ? 'Receipt_' . $invoice->receipt_number : 'Invoice_' . $invoice->invoice_number;
        while (ob_get_level() > 0) ob_end_clean();
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . preg_replace('/[^A-Za-z0-9_.-]/', '', $name) . '.pdf"');
        header('Content-Length: ' . strlen($pdf));
        echo $pdf;
        exit;
    }

    public function resend() {
        $this->checkAuth();
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);
        $model = new SaaSInvoiceModel();
        $inv = $model->getFullDetail($id);
        if (!$inv) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);
        $type = $_GET['type'] ?? ($inv->status === 'Paid' ? 'receipt' : 'invoice');
        try {
            if ($type === 'receipt') {
                $paymentId = isset($_GET['payment_id']) ? (int)$_GET['payment_id'] : null;
                $r = BillingService::emailReceipt($id, $paymentId);
            } else {
                if ($inv->status === 'Cancelled') return $this->json(['status' => 'error', 'message' => 'This invoice is cancelled.'], 400);
                $r = BillingService::emailInvoice($id, true);
            }
            return $this->json(['status' => $r === 'Sent' ? 'success' : 'error', 'message' => $r === 'Sent' ? 'Email sent' : 'Could not send the email. Check Mail Server settings.'], $r === 'Sent' ? 200 : 502);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function update() {
        $this->checkAuth();
        $d = $this->body();
        $id = (int)($d['id'] ?? 0);
        $model = new SaaSInvoiceModel();
        $inv = $id ? $model->getFullDetail($id) : null;
        if (!$inv) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);

        $set = [];
        if (array_key_exists('amount', $d)) {
            $amt = round((float)$d['amount'], 2);
            if ($amt <= 0) return $this->json(['status' => 'error', 'message' => 'Amount must be greater than zero.'], 400);
            if ($amt + BillingService::CENT < $inv->paid_total) return $this->json(['status' => 'error', 'message' => 'Amount cannot be less than what is already paid (' . number_format($inv->paid_total, 2) . ').'], 400);
            $set['amount'] = $amt;
        }
        if (array_key_exists('due_date', $d)) {
            $t = \DateTime::createFromFormat('!Y-m-d', (string)$d['due_date']);
            if (!$t) return $this->json(['status' => 'error', 'message' => 'Due date must be YYYY-MM-DD.'], 400);
            $set['due_date'] = $t->format('Y-m-d');
        }
        if (array_key_exists('billing_month', $d)) {
            $m = mb_substr(trim((string)$d['billing_month']), 0, 50);
            if ($m === '') return $this->json(['status' => 'error', 'message' => 'Billing period is required.'], 400);
            $set['billing_month'] = $m;
        }
        if (array_key_exists('status', $d)) {
            $s = (string)$d['status'];
            if ($s === 'Paid') return $this->json(['status' => 'error', 'message' => 'Record a payment to mark an invoice paid.'], 400);
            if (!in_array($s, ['Pending', 'Overdue', 'Cancelled'], true)) return $this->json(['status' => 'error', 'message' => 'Unknown status.'], 400);
            if ($s === 'Cancelled' && $inv->paid_total > 0) return $this->json(['status' => 'error', 'message' => 'Delete its payments before cancelling this invoice.'], 400);
            $set['status'] = $s;
        }
        if (!$set) return $this->json(['status' => 'error', 'message' => 'Nothing to update.'], 400);

        $model->update($id, $set);
        BillingService::recalcStatus($id); // Paid/Pending/Overdue from payments; a cancelled invoice stays cancelled
        return $this->json(['status' => 'success', 'message' => 'Invoice updated']);
    }

    public function deleteInvoice() {
        $this->checkAuth();
        $id = (int)($_GET['id'] ?? ($this->body()['id'] ?? 0));
        if (!$id) return $this->json(['status' => 'error', 'message' => 'Invoice ID required'], 400);
        if (BillingService::paidTotal($id) > 0) {
            return $this->json(['status' => 'error', 'message' => 'This invoice has payments. Delete the payments first, or cancel the invoice instead.'], 400);
        }
        $db = new Database();
        $db->query("DELETE FROM saas_email_logs WHERE invoice_id = :id");
        $db->bind(':id', $id);
        try { $db->execute(); } catch (\Throwable $e) { /* logs table may not reference invoices */ }
        if ((new SaaSInvoiceModel())->delete($id)) return $this->json(['status' => 'success', 'message' => 'Invoice deleted']);
        return $this->json(['status' => 'error', 'message' => 'Failed to delete invoice'], 500);
    }

    public function processPayment() {
        $this->checkAuth();
        $d = $this->body();
        $id = (int)($d['invoice_id'] ?? 0);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'Invoice ID required'], 400);
        if (!isset($d['amount']) || !is_numeric($d['amount'])) return $this->json(['status' => 'error', 'message' => 'Enter the amount received.'], 400);
        try {
            $r = BillingService::recordPayment($id, $d['amount'], $d['payment_method'] ?? 'Bank Transfer', $d['transaction_id'] ?? '');
            $msg = $r['status'] === 'Paid' ? 'Payment recorded. Invoice paid in full.' : 'Payment recorded. Balance ' . number_format($r['balance'], 2) . '.';
            if ($r['email'] !== 'Sent') $msg .= ' The receipt email could not be sent.';
            return $this->json(['status' => 'success', 'message' => $msg, 'data' => $r]);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function getPayments() {
        $this->checkAuth();
        $id = (int)($_GET['id'] ?? 0);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'Invoice ID required'], 400);
        return $this->json(['status' => 'success', 'data' => (new SaaSInvoiceModel())->getPayments($id)]);
    }

    public function listAllPayments() {
        $this->checkAuth();
        return $this->json(['status' => 'success', 'data' => (new SaaSInvoiceModel())->getAllPayments()]);
    }

    public function deletePayment() {
        $this->checkAuth();
        $id = (int)($_GET['id'] ?? ($this->body()['id'] ?? 0));
        if (!$id) return $this->json(['status' => 'error', 'message' => 'Payment ID required'], 400);
        $db = new Database();
        $db->query("SELECT invoice_id FROM saas_payments WHERE id = :id");
        $db->bind(':id', $id);
        $payment = $db->single();
        if (!$payment) return $this->json(['status' => 'error', 'message' => 'Payment not found'], 404);
        $db->query("DELETE FROM saas_payments WHERE id = :id");
        $db->bind(':id', $id);
        $db->execute();
        $status = BillingService::recalcStatus($payment->invoice_id);
        return $this->json(['status' => 'success', 'message' => "Payment deleted. Invoice is now $status.", 'data' => ['invoice_status' => $status]]);
    }

    public function getEmailLogs() {
        $this->checkAuth();
        return $this->json(['status' => 'success', 'data' => (new SaaSInvoiceModel())->getEmailLogs()]);
    }
}
