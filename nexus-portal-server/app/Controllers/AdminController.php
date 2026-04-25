<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\RequestModel;
use App\Models\AdminModel;

class AdminController extends Controller {
    public function __construct($route_params) {
        parent::__construct($route_params);
        $this->checkAuth();
    }

    private function checkAuth() {
        if (!isset($_SESSION['admin_id'])) {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }

    public function listRequests() {
        $model = new RequestModel();
        return $this->json(['status' => 'success', 'data' => $model->getAll()]);
    }

    public function updateStatus() {
        $data = $this->getPostData();
        $id = $data['id'] ?? 0;
        $status = $data['status'] ?? '';

        if (!$id || !$status) {
            return $this->json(['status' => 'error', 'message' => 'ID and Status required'], 400);
        }

        $model = new RequestModel();
        if ($model->updateStatus($id, $status)) {
            return $this->json(['status' => 'success', 'message' => 'Status updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function listUsers() {
        $model = new AdminModel();
        return $this->json(['status' => 'success', 'data' => $model->getAll()]);
    }

    public function createUser() {
        $data = $this->getPostData();
        if (empty($data['username']) || empty($data['password'])) {
            return $this->json(['status' => 'error', 'message' => 'Username and Password required'], 400);
        }

        $model = new AdminModel();
        if ($model->create($data)) {
            return $this->json(['status' => 'success', 'message' => 'Admin user created']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Creation failed'], 500);
        }
    }
}
