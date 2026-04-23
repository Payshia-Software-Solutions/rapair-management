<?php
/**
 * ApiClientController - Manages external API clients
 */
class ApiClientController extends Controller {
    private $apiClientModel;

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
    }

    // GET /api/apiclient/list
    public function list() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }
        $this->success($this->apiClientModel->list());
    }

    // POST /api/apiclient/create
    public function create() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['client_name']) || empty($data['domain'])) {
            $this->error('Client name and domain are required');
        }

        $id = $this->apiClientModel->create($data, $u['sub']);
        if ($id) {
            $this->success(['id' => $id], 'API Client created successfully');
        } else {
            $this->error('Failed to create API client');
        }
    }

    // POST /api/apiclient/regenerate/{id}
    public function regenerate($id) {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $newKey = $this->apiClientModel->regenerateKey($id, $u['sub']);
        if ($newKey) {
            $this->success(['key' => $newKey], 'API Key regenerated successfully');
        } else {
            $this->error('Failed to regenerate key');
        }
    }

    // POST /api/apiclient/toggle/{id}
    public function toggle($id) {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $data = json_decode(file_get_contents('php://input'), true);
        $isActive = $data['is_active'] ?? true;

        if ($this->apiClientModel->toggleStatus($id, $isActive, $u['sub'])) {
            $this->success(null, 'Client status updated');
        } else {
            $this->error('Failed to update status');
        }
    }

    // POST /api/apiclient/delete/{id}
    public function delete($id) {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        if ($this->apiClientModel->delete($id)) {
            $this->success(null, 'API Client deleted');
        } else {
            $this->error('Failed to delete client');
        }
    }
}
