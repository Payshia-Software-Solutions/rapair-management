<?php
class PaymentreceiptController extends Controller {
    private $model;

    public function __construct() {
        $this->model = new PaymentReceipt();
    }

    // POST /api/paymentreceipt/migrate — create tables
    public function migrate() {
        try {
            $this->model->ensureSchema();
            $this->json(['status' => 'success', 'message' => 'Payment receipt tables ready.']);
        } catch (Exception $e) {
            $this->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    // POST /api/paymentreceipt/create
    public function create() {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($data['invoice_id']) || empty($data['amount']) || empty($data['payment_date'])) {
            $this->json(['status' => 'error', 'message' => 'invoice_id, amount, payment_date required.'], 422);
            return;
        }

        // Enrich with logged-in user
        $data['created_by'] = $this->getAuthUserId();

        $receiptNo = $this->model->create($data);

        if ($receiptNo) {
            $this->json(['status' => 'success', 'receipt_no' => $receiptNo]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to record payment.'], 500);
        }
    }

    // GET /api/paymentreceipt/invoice/:invoiceId
    public function invoice($invoiceId = null) {
        if (!$invoiceId) { $this->json(['status' => 'error', 'message' => 'Missing invoice ID'], 422); return; }
        $receipts = $this->model->getByInvoice($invoiceId);
        $this->json(['status' => 'success', 'data' => $receipts]);
    }

    // GET /api/paymentreceipt/details/:id
    public function details($id = null) {
        if (!$id) { $this->json(['status' => 'error', 'message' => 'Missing ID'], 422); return; }
        $receipt = $this->model->getById($id);
        if (!$receipt) { $this->json(['status' => 'error', 'message' => 'Not found'], 404); return; }
        $this->json(['status' => 'success', 'data' => $receipt]);
    }

    // GET /api/paymentreceipt/list
    public function list() {
        $filters = [
            'method'      => $_GET['method'] ?? null,
            'from_date'   => $_GET['from_date'] ?? null,
            'to_date'     => $_GET['to_date'] ?? null,
            'customer_id' => $_GET['customer_id'] ?? null,
        ];
        $data = $this->model->listAll($filters);
        $this->json(['status' => 'success', 'data' => $data]);
    }

    // GET /api/paymentreceipt/cheques
    public function cheques() {
        $status = $_GET['status'] ?? null;
        $data = $this->model->listCheques($status);
        $this->json(['status' => 'success', 'data' => $data]);
    }

    // POST /api/paymentreceipt/chequestatus/:id
    public function chequestatus($chequeId = null) {
        if (!$chequeId) { $this->json(['status' => 'error', 'message' => 'Missing cheque ID'], 422); return; }
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $ok = $this->model->updateChequeStatus($chequeId, $data['status'] ?? 'Cleared', $data['cleared_date'] ?? null);
        $this->json(['status' => $ok ? 'success' : 'error']);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    private function getAuthUserId() {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';
        if (!$authHeader) return null;
        $token = str_replace('Bearer ', '', $authHeader);
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) return null;
            $payload = json_decode(base64_decode(str_replace(['-','_'], ['+','/'], $parts[1])), true);
            return $payload['user_id'] ?? null;
        } catch (Exception $e) { return null; }
    }

}
