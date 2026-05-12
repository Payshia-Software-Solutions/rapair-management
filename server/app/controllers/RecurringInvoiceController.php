<?php
/**
 * Recurring Invoice Controller
 */
class RecurringInvoiceController extends Controller {
    public function __construct() {
        $this->recurringModel = $this->model('RecurringInvoice');
    }

    public function list() {
        $this->requirePermission('invoices.read');
        $filters = [
            'status' => $_GET['status'] ?? null,
            'customer_id' => $_GET['customer_id'] ?? null
        ];
        $templates = $this->recurringModel->getAll($filters);
        $this->json(['success' => true, 'data' => $templates]);
    }

    public function get($id) {
        $this->requirePermission('invoices.read');
        $template = $this->recurringModel->getById($id);
        if ($template) {
            $template->items = $this->recurringModel->getItems($id);
            $this->json(['success' => true, 'data' => $template]);
        } else {
            $this->json(['success' => false, 'error' => 'Template not found'], 404);
        }
    }

    public function create() {
        $u = $this->requirePermission('invoices.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['success' => false, 'error' => 'Invalid request method'], 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['template_name']) || empty($data['customer_id']) || empty($data['items'])) {
            $this->json(['success' => false, 'error' => 'Missing required fields'], 400);
            return;
        }

        $data['userId'] = $u['sub'] ?? 1;
        $id = $this->recurringModel->create($data);
        if ($id) {
            $this->recurringModel->addItems($id, $data['items']);
            $this->json(['success' => true, 'id' => $id, 'message' => 'Recurring template created successfully']);
        } else {
            $this->json(['success' => false, 'error' => 'Failed to create template'], 500);
        }
    }

    public function update($id) {
        $u = $this->requirePermission('invoices.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['success' => false, 'error' => 'Invalid request method'], 405);
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);
        $data['userId'] = $u['sub'] ?? 1;
        
        if ($this->recurringModel->update($id, $data)) {
            $this->json(['success' => true, 'message' => 'Recurring template updated successfully']);
        } else {
            $this->json(['success' => false, 'error' => 'Failed to update template'], 500);
        }
    }

    public function process() {
        $u = $this->requirePermission('invoices.write');
        $userId = $u['sub'] ?? 1;
        $count = $this->recurringModel->generateDueInvoices($userId);
        $this->json(['success' => true, 'count' => $count, 'message' => "Generated $count invoices from templates"]);
    }

    public function force_generate($id) {
        $u = $this->requirePermission('invoices.write');
        $userId = $u['sub'] ?? 1;
        $invoiceId = $this->recurringModel->forceGenerate($id, $userId);
        if ($invoiceId) {
            // Fetch invoice number for feedback
            require_once '../app/models/Invoice.php';
            $invModel = new Invoice();
            $inv = $invModel->getById($invoiceId);
            $this->json([
                'success' => true, 
                'id' => $invoiceId, 
                'invoice_no' => $inv ? $inv->invoice_no : 'N/A',
                'message' => 'Invoice generated successfully'
            ]);
        } else {
            $this->json(['success' => false, 'error' => 'Failed to generate invoice'], 500);
        }
    }
}
