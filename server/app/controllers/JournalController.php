<?php
/**
 * JournalController
 */
class JournalController extends Controller {
    private $journalModel;

    public function __construct() {
        $this->journalModel = $this->model('Journal');
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
            case 'items':
                $this->items();
                break;
            case 'post':
                $this->post();
                break;
            default:
                $this->json(['status' => 'error', 'message' => 'Invalid action'], 400);
        }
    }

    public function list() {
        $filters = [];
        if (isset($_GET['id'])) $filters['id'] = $_GET['id'];
        if (isset($_GET['ref_type'])) $filters['ref_type'] = $_GET['ref_type'];
        if (isset($_GET['ref_id'])) $filters['ref_id'] = $_GET['ref_id'];
        if (isset($_GET['from'])) $filters['from'] = $_GET['from'];
        if (isset($_GET['to'])) $filters['to'] = $_GET['to'];
        if (isset($_GET['limit'])) $filters['limit'] = $_GET['limit'];
        if (isset($_GET['offset'])) $filters['offset'] = $_GET['offset'];

        $entries = $this->journalModel->getEntries($filters);
        $total = $this->journalModel->countEntries($filters);
        
        $this->json([
            'status' => 'success', 
            'data' => $entries,
            'total' => $total,
            'limit' => (int)($filters['limit'] ?? 0),
            'offset' => (int)($filters['offset'] ?? 0)
        ]);
    }

    public function items() {
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $this->json(['status' => 'error', 'message' => 'Missing entry ID'], 400);
            return;
        }

        $items = $this->journalModel->getEntryItems($id);
        $this->json(['status' => 'success', 'data' => $items]);
    }

    public function post() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['items'])) {
            $this->json(['status' => 'error', 'message' => 'Missing entry data'], 400);
            return;
        }

        $id = $this->journalModel->post($input);
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Journal entry posted', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to post journal entry. Check balance.'], 500);
        }
    }
}
