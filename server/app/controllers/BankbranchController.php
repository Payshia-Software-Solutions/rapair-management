<?php
class BankbranchController extends Controller {
    private $model;

    public function __construct() {
        $this->model = new BankBranch();
    }

    // POST /api/bankbranch/migrate
    public function migrate() {
        try {
            $this->model->ensureSchema();
            $this->json(['status' => 'success', 'message' => 'Bank branch table ready.']);
        } catch (Exception $e) {
            $this->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    // GET /api/bankbranch/bank/:bankId
    public function bank($bankId = null) {
        if (!$bankId) {
            $this->json(['status' => 'error', 'message' => 'Missing bank ID'], 422);
            return;
        }
        $all = isset($_GET['all']) && $_GET['all'] === '1';
        $branches = $this->model->getByBank($bankId, !$all); 
        $this->json(['status' => 'success', 'data' => $branches]);
    }

    // POST /api/bankbranch/store
    public function store() {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['bank_id']) || empty($data['branch_name'])) {
            $this->json(['status' => 'error', 'message' => 'Bank ID and Branch Name are required'], 400);
            return;
        }
        if ($this->model->create($data)) {
            $this->json(['status' => 'success', 'message' => 'Branch created']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to create branch'], 500);
        }
    }

    // POST /api/bankbranch/update/{id}
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['bank_id']) || empty($data['branch_name'])) {
            $this->json(['status' => 'error', 'message' => 'Bank ID and Branch Name are required'], 400);
            return;
        }
        if ($this->model->update($id, $data)) {
            $this->json(['status' => 'success', 'message' => 'Branch updated']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to update branch'], 500);
        }
    }

    // DELETE /api/bankbranch/delete/{id}
    public function delete($id) {
        if ($this->model->delete($id)) {
            $this->json(['status' => 'success', 'message' => 'Branch deleted']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to delete branch'], 500);
        }
    }

}
