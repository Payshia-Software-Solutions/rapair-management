<?php
/**
 * AccountController
 */
class AccountController extends Controller {
    private $accountModel;

    public function __construct() {
        $this->accountModel = $this->model('Account');
    }

    public function index($action = 'list', $param = null) {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        switch ($action) {
            case 'list':
                $this->list();
                break;
            case 'ledger':
                $this->ledger($param);
                break;
            case 'create':
                $this->create();
                break;
            case 'get_mappings':
                $this->get_mappings();
                break;
            case 'update_mapping':
                $this->update_mapping();
                break;
            case 'post_supplier_payment':
                $this->post_supplier_payment();
                break;
            case 'post_purchase_return':
                $this->post_purchase_return();
                break;
            default:
                $this->json(['status' => 'error', 'message' => 'Invalid action'], 400);
        }
    }

    public function list() {
        $type = $_GET['type'] ?? null;
        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        $as_of = $_GET['as_of'] ?? null;

        $filters = [];
        if ($type) $filters['type'] = strtoupper($type);
        
        if ($as_of) {
            $accounts = $this->accountModel->getBalancesAsOf($as_of);
        } elseif ($from && $to) {
            $accounts = $this->accountModel->getPeriodActivity($from, $to);
        } else {
            $accounts = $this->accountModel->getAll($filters);
        }
        
        $this->json(['status' => 'success', 'data' => $accounts]);
    }

    public function ledger($id) {
        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Account ID required'], 400);
            return;
        }

        $from = $_GET['from'] ?? null;
        $to = $_GET['to'] ?? null;
        $limit = $_GET['limit'] ?? null;
        $offset = $_GET['offset'] ?? null;

        require_once '../app/models/Journal.php';
        $journalModel = new Journal();
        $ledger = $journalModel->getAccountLedger($id, $from, $to, $limit, $offset);
        $total = $journalModel->countAccountLedger($id, $from, $to);
        
        $account = $this->accountModel->getById($id);

        $this->json([
            'status' => 'success', 
            'account' => $account,
            'data' => $ledger,
            'total' => $total,
            'limit' => (int)$limit,
            'offset' => (int)$offset
        ]);
    }

    public function create() {
        $u = $this->requirePermission('accounting.setup');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['code']) || empty($input['name']) || empty($input['type'])) {
            $this->json(['status' => 'error', 'message' => 'Missing required fields'], 400);
            return;
        }

        $input['userId'] = $u['sub'];
        $id = $this->accountModel->create($input);
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Account created', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to create account'], 500);
        }
    }

    public function update_mapping() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['key']) || empty($input['account_id'])) {
            $this->json(['status' => 'error', 'message' => 'Missing required fields'], 400);
            return;
        }

        require_once '../app/models/AccountMapping.php';
        $mappingModel = new AccountMapping();
        $ok = $mappingModel->update($input['key'], $input['account_id']);
        
        if ($ok) {
            $this->json(['status' => 'success', 'message' => 'Mapping updated']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to update mapping'], 500);
        }
    }

    public function post_supplier_payment() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        require_once '../app/models/SupplierPayment.php';
        $paymentModel = new SupplierPayment();
        $id = $paymentModel->create($input);
        
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Payment recorded', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to record payment'], 500);
        }
    }

    public function post_purchase_return() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        require_once '../app/models/PurchaseReturn.php';
        $returnModel = new PurchaseReturn();
        $id = $returnModel->create($input);
        
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Return recorded', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to record return'], 500);
        }
    }

    public function get_mappings() {
        require_once '../app/models/AccountMapping.php';
        $mappingModel = new AccountMapping();
        $mappings = $mappingModel->getAll();
        $this->json(['status' => 'success', 'data' => $mappings]);
    }
}
