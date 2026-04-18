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
        $invoice['batch_movements'] = $this->invoiceModel->getBatchMovements($id);

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

        // Ensure schema is up to date BEFORE starting a transaction
        $this->invoiceModel->ensureSchema();
        
        if (empty($data['customer_id']) || empty($data['items'])) {
            $this->error('Missing required fields', 400);
            return;
        }

        // Generate Invoice Number
        $invoiceNo = $this->generateInvoiceNo();
        $data['invoice_no'] = $invoiceNo;
        $data['userId'] = $u['sub'];

        // Ensure schema is up to date BEFORE starting a transaction
        // (MySQL commits implicitly on DDL like CREATE/ALTER)
        require_once '../app/models/PaymentReceipt.php';
        $receiptModel = new PaymentReceipt();
        $receiptModel->ensureSchema();

        $db = new Database();
        $db->beginTransaction();

        try {
            $invoiceId = $this->invoiceModel->create($data);
            if (!$invoiceId) throw new Exception('Failed to create invoice');

            $this->invoiceModel->addItems($invoiceId, $data['items']);
            if (!empty($data['applied_taxes'])) {
                $this->invoiceModel->addAppliedTaxes($invoiceId, $data['applied_taxes']);
            }

            // Post to Accounting AFTER all items are in the DB
            require_once '../app/helpers/AccountingHelper.php';
            AccountingHelper::postInvoice($invoiceId);

            // Optional: Process Payments immediately
            if (!empty($data['payments']) && is_array($data['payments'])) {
                foreach ($data['payments'] as $p) {
                    if (($p['method'] ?? '') === 'Credit') continue;
                    
                    $receiptData = [
                        'invoice_id' => $invoiceId,
                        'invoice_no' => $invoiceNo,
                        'customer_id' => $data['customer_id'],
                        'location_id' => $data['location_id'] ?? $this->currentLocationId($u),
                        'amount' => $p['amount'],
                        'payment_method' => $p['method'],
                        'payment_date' => $data['issue_date'] ?? date('Y-m-d'),
                        'created_by' => $u['sub'],
                        'card_type' => $p['cardType'] ?? null,
                        'card_last4' => $p['cardLast4'] ?? null,
                        'card_auth_code' => $p['cardAuthCode'] ?? null,
                        'cheque' => [
                            'cheque_no' => $p['chequeNo'] ?? '',
                            'bank_name' => $p['chequeBankName'] ?? '',
                            'branch_name' => $p['chequeBranchName'] ?? '',
                            'cheque_date' => $p['chequeDate'] ?? date('Y-m-d'),
                            'payee_name' => $p['chequePayee'] ?? ''
                        ]
                    ];
                    $receiptModel->create($receiptData);
                }
            }

            $db->commit();
            
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
            // Optional: Mark held order as completed if it came from a held bill
            if (!empty($data['held_order_id'])) {
                require_once '../app/models/PosHeldOrder.php';
                $holdModel = new PosHeldOrder();
                $holdModel->complete($data['held_order_id']);
            }

            $db->commit();
            $this->success(['id' => $invoiceId, 'message' => 'Invoice created successfully']);
        } catch (Exception $e) {
            $db->rollBack();
            $this->error($e->getMessage());
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

        // Fetch Invoice to get metadata
        $invoice = $this->invoiceModel->getById($id);
        if (!$invoice) {
            $this->error('Invoice not found', 404);
            return;
        }

        require_once '../app/models/PaymentReceipt.php';
        $receiptModel = new PaymentReceipt();

        $receiptData = [
            'invoice_id' => $id,
            'invoice_no' => $invoice->invoice_no,
            'customer_id' => $invoice->customer_id,
            'customer_name' => $invoice->customer_name,
            'location_id' => $this->currentLocationId($u),
            'amount' => $data['amount'],
            'payment_method' => $data['payment_method'] ?? 'Cash',
            'payment_date' => $data['payment_date'],
            'reference_no' => $data['reference_no'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $u['sub']
        ];

        if ($receiptModel->create($receiptData)) {
            $this->auditModel->write([
                'user_id' => (int)$u['sub'],
                'action' => 'payment',
                'entity' => 'invoice',
                'entity_id' => (int)$id,
                'method' => 'POST',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
                'details' => json_encode(['amount' => $data['amount'], 'method' => $data['payment_method'] ?? 'Cash']),
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
