<?php
/**
 * ChecklistController - handles checklist items for repair orders.
 */

class ChecklistController extends Controller {
    private $checklistModel;

    public function __construct() {
        $this->checklistModel = $this->model('ChecklistItem');
    }

    // GET /api/checklist/list/{orderId}
    public function list($orderId = null) {
        $this->requirePermission('checklists.read');
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$orderId) {
            $this->error('Order ID required', 400);
            return;
        }
        $items = $this->checklistModel->getByOrderId($orderId);
        $this->success($items);
    }

    // POST /api/checklist/add/{orderId}
    public function add($orderId = null) {
        $this->requirePermission('checklists.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$orderId) {
            $this->error('Order ID required', 400);
            return;
        }
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        if (!isset($data['description'])) {
            $this->error('Description required', 400);
            return;
        }
        $added = $this->checklistModel->addItem($orderId, $data['description']);
        if ($added) {
            $this->success(['orderId' => $orderId, 'description' => $data['description']], 'Checklist item added');
        } else {
            $this->error('Failed to add checklist item');
        }
    }
}
