<?php
/**
 * ReconciliationController
 */
class ReconciliationController extends Controller {
    private $reconModel;

    public function __construct() {
        $this->reconModel = $this->model('Reconciliation');
    }

    public function index($action = 'list', $param = null) {
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(204);
            exit;
        }

        switch ($action) {
            case 'transactions':
            case 'unreconciled':
                $this->getTransactions();
                break;
            case 'finalize':
                $this->finalize();
                break;
            case 'history':
                $this->getHistory();
                break;
            default:
                $this->json(['status' => 'error', 'message' => 'Invalid action'], 400);
        }
    }

    // The router maps /api/reconciliation/{segment} straight to a method of the same name,
    // so these are the real entry points (index() above is only reached for a bare URL).
    public function unreconciled() { $this->getTransactions(); }
    public function transactions() { $this->getTransactions(); }
    public function history() { $this->getHistory(); }

    public function getTransactions() {
        $u = $this->requirePermission('accounting.reconcile');
        $accountId = $_GET['account_id'] ?? null;
        if (!$accountId) {
            $this->json(['status' => 'error', 'message' => 'Account ID required'], 400);
            return;
        }

        $asOf = $_GET['as_of_date'] ?? null;
        if ($asOf && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $asOf)) $asOf = null;
        $items = $this->reconModel->getUnreconciledItems($accountId, $asOf);
        $this->json(['status' => 'success', 'data' => $items]);
    }

    public function finalize() {
        $u = $this->requirePermission('accounting.reconcile');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['account_id']) || !isset($input['statement_balance'])) {
            $this->json(['status' => 'error', 'message' => 'Missing required fields'], 400);
            return;
        }

        $input['userId'] = $u['sub'];
        $input['is_finalized'] = 1;

        // 1. Create Reconciliation Record
        $reconId = $this->reconModel->create($input);
        
        if ($reconId) {
            // 2. Mark items as reconciled
            if (!empty($input['cleared_item_ids'])) {
                $this->reconModel->finalizeItems($input['cleared_item_ids'], $input['statement_date']);
            }
            $this->json(['status' => 'success', 'message' => 'Reconciliation finalized', 'id' => $reconId]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to save reconciliation'], 500);
        }
    }

    public function getHistory() {
        $u = $this->requirePermission('accounting.reconcile');
        $accountId = $_GET['account_id'] ?? null;
        if (!$accountId) {
            $this->json(['status' => 'error', 'message' => 'Account ID required'], 400);
            return;
        }

        $history = $this->reconModel->getHistory($accountId);
        $this->json(['status' => 'success', 'data' => $history]);
    }
}
