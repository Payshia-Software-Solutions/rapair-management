<?php
/**
 * PayeeController
 */
class PayeeController extends Controller {
    private $payeeModel;

    public function __construct() {
        $this->payeeModel = $this->model('Payee');
    }

    public function list() {
        $this->requirePermission('accounting.read');
        $data = $this->payeeModel->getAll();
        $this->json(['status' => 'success', 'data' => $data]);
    }

    public function create() {
        $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (empty($input['name'])) {
            $this->json(['status' => 'error', 'message' => 'Name is required'], 400);
            return;
        }

        $id = $this->payeeModel->create($input);
        if ($id) {
            $this->json(['status' => 'success', 'message' => 'Payee saved', 'id' => $id]);
        } else {
            $this->json(['status' => 'error', 'message' => 'Failed to save payee'], 500);
        }
    }

    public function update($id) {
        $this->requirePermission('accounting.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['status' => 'error', 'message' => 'Method not allowed'], 405);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if ($this->payeeModel->update($id, $input)) {
            $this->json(['status' => 'success', 'message' => 'Payee updated']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Update failed']);
        }
    }

    public function delete($id) {
        $this->requirePermission('accounting.write');
        if ($this->payeeModel->delete($id)) {
            $this->json(['status' => 'success', 'message' => 'Payee deleted']);
        } else {
            $this->json(['status' => 'error', 'message' => 'Delete failed']);
        }
    }
}
