<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\TenantModel;
use App\Models\SaaSInvoiceModel;

class BillingController extends Controller {
    
    private function checkAuth() {
        if (!isset($_SESSION['admin_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
        return true;
    }

    private function checkSuperAdmin() {
        if (!isset($_SESSION['admin_role']) || $_SESSION['admin_role'] !== 'super_admin') {
            return $this->json(['status' => 'error', 'message' => 'Forbidden'], 403);
        }
        return true;
    }

    public function runBillingCycle() {
        if ($this->checkAuth() !== true) return;
        if ($this->checkSuperAdmin() !== true) return;

        $tenantModel = new TenantModel();
        $invoiceModel = new SaaSInvoiceModel();
        
        $tenantId = $_GET['tenant_id'] ?? null;
        $currentMonth = $_GET['period'] ?? date('F Y');
        
        if ($tenantId) {
            $tenants = [$tenantModel->getByIdWithPackage($tenantId)];
            if (!$tenants[0]) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);
        } else {
            $tenants = $tenantModel->getAllActive();
        }
        
        $count = 0;
        $dueDate = date('Y-m-d', strtotime('+10 days'));

        foreach ($tenants as $tenant) {
            $tid = is_object($tenant) ? $tenant->id : $tenant['id'];
            $basePrice = is_object($tenant) ? ($tenant->monthly_price ?? 0) : ($tenant['monthly_price'] ?? 0);
            $currency = is_object($tenant) ? ($tenant->currency ?? 'USD') : ($tenant['currency'] ?? 'USD');
            $tenantName = is_object($tenant) ? $tenant->name : $tenant['name'];
            $adminEmail = is_object($tenant) ? $tenant->admin_email : $tenant['admin_email'];
            $address = is_object($tenant) ? ($tenant->address ?? '') : ($tenant['address'] ?? '');

            // Currency Conversion Logic (Base: USD)
            $monthlyPrice = $basePrice;
            $rates = \App\Services\ExchangeRateService::getRates();
            $exchangeRate = $rates[$currency] ?? 1;
            
            // Get active source for transparency
            $db = new \App\Core\Database();
            $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'exchange_rate_source'");
            $source = $db->single()->setting_value ?? 'Market';

            if ($currency !== 'USD' && isset($rates[$currency])) {
                $monthlyPrice = $basePrice * $exchangeRate;
            }

            // Check if invoice already exists for this month
            if (!$invoiceModel->exists($tid, $currentMonth)) {
                $invoiceNumber = 'INV-' . strtoupper(substr(md5(uniqid()), 0, 8));
                
                // Add billing info for PDF
                $pdfData = (object)[
                    'invoice_number' => $invoiceNumber,
                    'tenant_name' => $tenantName,
                    'address' => $address,
                    'admin_email' => $adminEmail,
                    'amount' => $monthlyPrice,
                    'currency' => $currency,
                    'exchange_rate' => $exchangeRate,
                    'source' => strtoupper($source),
                    'billing_month' => $currentMonth,
                    'due_date' => $dueDate,
                    'status' => 'Pending',
                    'created_at' => date('Y-m-d H:i:s')
                ];
                
                $invoiceId = $invoiceModel->create([
                    'tenant_id' => $tid,
                    'invoice_number' => $invoiceNumber,
                    'amount' => $monthlyPrice,
                    'billing_month' => $currentMonth,
                    'due_date' => $dueDate,
                    'status' => 'Pending'
                ]);

                if ($invoiceId) {
                    $count++;
                    // Generate PDF & Send Email
                    try {
                        $pdf = \App\Services\InvoicePDF::generate($pdfData);
                        $sent = \App\Core\Mailer::sendInvoiceEmail($adminEmail, $tenantName, $invoiceNumber, $pdf, $currentMonth);
                        
                        // Update Email Status
                        $invoiceModel->update($invoiceId, [
                            'email_status' => $sent ? 'Sent' : 'Failed',
                            'last_sent_at' => date('Y-m-d H:i:s')
                        ]);
                    } catch (\Exception $e) {
                        // Log error but continue
                    }
                }
            }
        }

        return $this->json([
            'status' => 'success', 
            'message' => $tenantId ? "Processed billing for " . (is_object($tenants[0]) ? $tenants[0]->name : $tenants[0]['name']) : "Generated $count invoices",
            'processed' => $count
        ]);
    }

    public function getMyHistory() {
        if ($this->checkAuth() !== true) return;
        
        if (!isset($_SESSION['tenant_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }

        $model = new SaaSInvoiceModel();
        $history = $model->getByTenant($_SESSION['tenant_id']);
        
        return $this->json(['status' => 'success', 'data' => $history]);
    }

    public function listAll() {
        if ($this->checkAuth() !== true) return;
        if ($this->checkSuperAdmin() !== true) return;

        $model = new SaaSInvoiceModel();
        $invoices = $model->getAllWithTenants();
        
        return $this->json(['status' => 'success', 'data' => $invoices]);
    }

    public function download() {
        if ($this->checkAuth() !== true) return;
        
        $id = $_GET['id'] ?? null;
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);

        $model = new SaaSInvoiceModel();
        $invoice = $model->getFullDetail($id);

        if (!$invoice) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);

        // Security: Clients can only download their own
        if ($_SESSION['admin_role'] !== 'super_admin' && $invoice->tenant_id != $_SESSION['tenant_id']) {
            return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 403);
        }

        $type = $_GET['type'] ?? null;
        $isReceipt = ($type === 'receipt') || (!$type && $invoice->status === 'Paid');
        
        // Force invoice if requested
        if ($type === 'invoice') $isReceipt = false;

        $pdf = \App\Services\InvoicePDF::generate($invoice, $isReceipt);
        $prefix = $isReceipt ? 'Receipt_' : 'Invoice_';
        
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="'.$prefix.$invoice->invoice_number.'.pdf"');
        echo $pdf;
        exit;
    }

    public function resend() {
        if ($this->checkAuth() !== true) return;
        if ($this->checkSuperAdmin() !== true) return;

        $id = $_GET['id'] ?? null;
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);

        $model = new SaaSInvoiceModel();
        $invoice = $model->getFullDetail($id);

        if (!$invoice) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);

        $pdf = \App\Services\InvoicePDF::generate($invoice, $invoice->status === 'Paid');
        $sent = \App\Core\Mailer::sendInvoiceEmail($invoice->admin_email, $invoice->tenant_name, $invoice->invoice_number, $pdf);

        $model->update($id, [
            'email_status' => $sent ? 'Sent' : 'Failed',
            'last_sent_at' => date('Y-m-d H:i:s')
        ]);

        return $this->json([
            'status' => $sent ? 'success' : 'error', 
            'message' => $sent ? 'Email sent successfully' : 'Failed to send email'
        ]);
    }

    public function update() {
        if ($this->checkAuth() !== true) return;
        if ($this->checkSuperAdmin() !== true) return;

        $data = json_decode(file_get_contents('php://input'), true);
        $id = $data['id'] ?? null;
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);

        $model = new SaaSInvoiceModel();
        
        // If status is being changed to Paid, we might want to send receipt
        $oldStatus = null;
        if (isset($data['status']) && $data['status'] === 'Paid') {
            $invoice = $model->getFullDetail($id);
            $oldStatus = $invoice->status;
        }

        unset($data['id']);
        if ($model->update($id, $data)) {
            // Trigger receipt if newly paid
            if (isset($data['status']) && $data['status'] === 'Paid' && $oldStatus !== 'Paid') {
                $invoice = $model->getFullDetail($id);
                $pdf = \App\Services\InvoicePDF::generate($invoice, true);
                \App\Core\Mailer::sendPaymentReceipt($invoice->admin_email, $invoice->tenant_name, $invoice->invoice_number, $pdf);
            }
            return $this->json(['status' => 'success', 'message' => 'Invoice updated']);
        }
        
        return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
    }

    public function deleteInvoice() {
        if ($this->checkAuth() !== true) return;
        if ($this->checkSuperAdmin() !== true) return;

        $id = $_GET['id'] ?? null;
        if (!$id) return $this->json(['status' => 'error', 'message' => 'Invoice ID required'], 400);

        $model = new SaaSInvoiceModel();
        if ($model->delete($id)) {
            return $this->json(['status' => 'success', 'message' => 'Invoice deleted successfully']);
        }
        return $this->json(['status' => 'error', 'message' => 'Failed to delete invoice'], 500);
    }

    public function processPayment() {
        if (!isset($_SESSION['admin_id'])) return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);

        $data = json_decode(file_get_contents('php://input'), true);
        $invoiceId = $data['invoice_id'] ?? null;
        $method = $data['payment_method'] ?? 'Bank Transfer';
        $transactionId = $data['transaction_id'] ?? '';

        if (!$invoiceId) return $this->json(['status' => 'error', 'message' => 'Invoice ID required'], 400);

        $invoiceModel = new \App\Models\InvoiceModel();
        $invoice = $invoiceModel->getById($invoiceId);
        if (!$invoice) return $this->json(['status' => 'error', 'message' => 'Invoice not found'], 404);

        $receiptNumber = 'RCP-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 4));

        // Start Transaction (Mocked via Model)
        $db = new \App\Core\Database();
        $db->query("INSERT INTO saas_payments (invoice_id, receipt_number, amount, payment_method, transaction_id) VALUES (:iid, :rn, :amt, :pm, :tid)");
        $db->bind(':iid', $invoiceId);
        $db->bind(':rn', $receiptNumber);
        $db->bind(':amt', $invoice->amount);
        $db->bind(':pm', $method);
        $db->bind(':tid', $transactionId);
        
        if ($db->execute()) {
            // Update Invoice Status
            $invoiceModel->update($invoiceId, ['status' => 'Paid']);

            // Get Company Info for Receipt
            $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'company_%'");
            $settingsArr = $db->resultSet();
            $company = [];
            foreach ($settingsArr as $s) $company[$s->setting_key] = $s->setting_value;

            // Prepare Receipt Data
            $receiptData = (object)array_merge((array)$company, [
                'receipt_number' => $receiptNumber,
                'payment_date' => date('Y-m-d H:i:s'),
                'tenant_name' => $invoice->tenant_name,
                'invoice_number' => $invoice->invoice_number,
                'billing_month' => $invoice->billing_month,
                'amount' => $invoice->amount,
                'currency' => $invoice->currency,
                'payment_method' => $method,
                'transaction_id' => $transactionId
            ]);

            try {
                $pdf = \App\Services\ReceiptPDF::generate($receiptData);
                \App\Core\Mailer::sendPaymentReceiptEmail($invoice->admin_email, $invoice->tenant_name, $receiptNumber, $pdf, $invoice->amount, $invoice->currency);
            } catch (\Exception $e) {}

            return $this->json(['status' => 'success', 'message' => 'Payment processed and receipt sent']);
        }

        return $this->json(['status' => 'error', 'message' => 'Failed to process payment'], 500);
    }
}
