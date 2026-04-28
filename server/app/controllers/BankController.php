<?php
class BankController extends Controller {
    private $model;

    public function __construct() {
        $this->model = new Bank();
    }

    // GET /api/bank/details/{id}
    public function details($id) {
        $bank = $this->model->getById($id);
        if ($bank) {
            $this->json(['status' => 'success', 'data' => $bank]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Bank not found'], 404);
        }
    }

    // POST /api/bank/migrate
    public function migrate() {
        try {
            $this->model->ensureSchema();
            $this->json(['status' => 'success', 'message' => 'Bank tables ready.']);
        } catch (Exception $e) {
            $this->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    // GET /api/bank/list
    public function list() {
        $banks = $this->model->getAll(); // Load all for management
        $this->json(['status' => 'success', 'data' => $banks]);
    }

    // POST /api/bank/store
    public function store() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            $this->json(['status' => 'error', 'message' => 'Name is required'], 400);
            return;
        }
        if ($this->model->create($data)) {
            $this->json(['status' => 'success', 'message' => 'Bank created']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to create bank'], 500);
        }
    }

    // POST /api/bank/update/{id}
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            $this->json(['status' => 'error', 'message' => 'Name is required'], 400);
            return;
        }
        if ($this->model->update($id, $data)) {
            $this->json(['status' => 'success', 'message' => 'Bank updated']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to update bank'], 500);
        }
    }

    // DELETE /api/bank/delete/{id}
    public function delete($id) {
        if ($this->model->delete($id)) {
            $this->json(['status' => 'success', 'message' => 'Bank deleted']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to delete bank'], 500);
        }
    }

    // POST /api/bank/sync
    public function sync() {
        try {
            $newBranchesCount = $this->model->syncFromInternet();
            $this->json([
                'status' => 'success', 
                'message' => "Synchronization complete. Imported $newBranchesCount new branch records."
            ]);
        } catch (Exception $e) {
            $this->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}
