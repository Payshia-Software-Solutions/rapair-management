<?php
/**
 * InvoiceController
 */
class InvoiceController extends Controller {
    private $invoiceModel;
    private $auditModel;

    public function __construct() {
        $this->invoiceModel = $this->model('Invoice');
        $this->auditModel = $this->model('AuditLog');
    }

    public function list() {
        $this->requirePermission('invoices.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $filters = [
            'status' => $_GET['status'] ?? null,
            'customer_id' => $_GET['customer_id'] ?? null
        ];

        $invoices = $this->invoiceModel->getAll($filters);
        $this->success($invoices);
    }

    public function details($id = null) {
        $this->requirePermission('invoices.read');
        if (!$id) {
            $this->error('Invoice ID required', 400);
            return;
        }

        $invoice = $this->invoiceModel->getById($id);
        if (!$invoice) {
            $this->error('Invoice not found', 404);
            return;
        }

        $invoice = (array)$invoice;
        $invoice['items'] = $this->invoiceModel->getItems($id);
        $invoice['payments'] = $this->invoiceModel->getPayments($id);
        $invoice['applied_taxes'] = $this->invoiceModel->getAppliedTaxes($id);

        $this->success($invoice);
    }

    public function create() {
        $u = $this->requirePermission('invoices.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (empty($data['customer_id']) || empty($data['items'])) {
            $this->error('Missing required fields', 400);
            return;
        }

        // Generate Invoice Number
        $invoiceNo = $this->generateInvoiceNo();
        $data['invoice_no'] = $invoiceNo;
        $data['userId'] = $u['sub'];

        $invoiceId = $this->invoiceModel->create($data);
        if ($invoiceId) {
            $this->invoiceModel->addItems($invoiceId, $data['items']);
            if (!empty($data['applied_taxes'])) {
                $this->invoiceModel->addAppliedTaxes($invoiceId, $data['applied_taxes']);
            }
            
            // Audit Log
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'create',
                'entity' => 'invoice',
                'entity_id' => (int)$invoiceId,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['invoice_no' => $invoiceNo]),
            ]);

            $this->success(['id' => $invoiceId, 'invoice_no' => $invoiceNo], 'Invoice created successfully');
        } else {
            $this->error('Failed to create invoice');
        }
    }

    public function addPayment($id = null) {
        $u = $this->requirePermission('invoices.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        if (!$id) {
            $this->error('Invoice ID required', 400);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $data['userId'] = $u['sub'];

        if (empty($data['amount']) || empty($data['payment_date'])) {
            $this->error('Amount and date required', 400);
            return;
        }

        if ($this->invoiceModel->addPayment($id, $data)) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'payment',
                'entity' => 'invoice',
                'entity_id' => (int)$id,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['amount' => $data['amount']]),
            ]);
            $this->success(null, 'Payment added successfully');
        } else {
            $this->error('Failed to add payment');
        }
    }

    private function generateInvoiceNo() {
        $db = new Database();
        $db->query("SELECT prefix, next_number, padding FROM document_sequences WHERE doc_type = 'INV' FOR UPDATE");
        $seq = $db->single();
        
        if (!$seq) {
            return 'INV-' . time();
        }

        $invoiceNo = $seq->prefix . str_pad($seq->next_number, $seq->padding, '0', STR_PAD_LEFT);

        // Update sequence
        $db->query("UPDATE document_sequences SET next_number = next_number + 1 WHERE doc_type = 'INV'");
        $db->execute();

        return $invoiceNo;
    }
}
