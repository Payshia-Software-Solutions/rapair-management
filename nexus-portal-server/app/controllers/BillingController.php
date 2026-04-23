<?php
namespace App\Controllers;

use App\Core\Controller;
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
        $tenants = $tenantModel->getAllActive();
        
        $count = 0;
        $currentMonth = date('F Y');
        $dueDate = date('Y-m-d', strtotime('+10 days'));

        foreach ($tenants as $tenant) {
            // Check if invoice already exists for this month
            if (!$invoiceModel->exists($tenant['id'], $currentMonth)) {
                $invoiceNumber = 'INV-' . strtoupper(substr(md5(uniqid()), 0, 8));
                $invoiceId = $invoiceModel->create([
                    'tenant_id' => $tenant['id'],
                    'invoice_number' => $invoiceNumber,
                    'amount' => $tenant['monthly_price'],
                    'billing_month' => $currentMonth,
                    'due_date' => $dueDate,
                    'status' => 'Pending'
                ]);

                if ($invoiceId) {
                    $count++;
                    // Generate PDF & Send Email
                    $data = array_merge($tenant, [
                        'invoice_number' => $invoiceNumber,
                        'amount' => $tenant['monthly_price'],
                        'billing_month' => $currentMonth,
                        'due_date' => $dueDate,
                        'status' => 'Pending',
                        'created_at' => date('Y-m-d H:i:s')
                    ]);
                    $pdf = \App\Services\InvoicePDF::generate((object)$data);
                    $sent = \App\Core\Mailer::sendInvoiceEmail($tenant['admin_email'], $tenant['name'], $invoiceNumber, $pdf);
                    
                    // Update Email Status
                    $invoiceModel->update($invoiceId, [
                        'email_status' => $sent ? 'Sent' : 'Failed',
                        'last_sent_at' => date('Y-m-d H:i:s')
                    ]);
                }
            }
        }

        return $this->json(['status' => 'success', 'message' => "Generated $count invoices and sent notifications"]);
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
}
