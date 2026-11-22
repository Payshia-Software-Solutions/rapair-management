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

    // POST /api/apiclient/site/{id}  {revalidate_url, revalidate_secret?}  Where this website is told to refresh.
    public function site($id) {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $url = trim((string)($data['revalidate_url'] ?? ''));
        $secret = isset($data['revalidate_secret']) ? (string)$data['revalidate_secret'] : null;

        if ($url !== '') {
            require_once __DIR__ . '/../helpers/StorefrontNotifier.php';
            $problem = StorefrontNotifier::urlProblem($url);
            if ($problem) { $this->error($problem, 400); }
            $client = $this->apiClientModel->getById($id);
            if (!$client) { $this->error('API client not found', 404); }
            if (($secret === null || $secret === '') && empty($client->revalidate_secret)) {
                $this->error('Enter the secret the website expects.', 400);
            }
        }
        if ($this->apiClientModel->setSite($id, $url, $secret, $u['sub'])) {
            $this->success(null, $url === '' ? 'Website refresh turned off' : 'Website refresh saved');
        } else {
            $this->error('Failed to save');
        }
    }

    // POST /api/apiclient/test/{id}  Sends one refresh request to the website and reports the result.
    public function test($id) {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }
        require_once __DIR__ . '/../helpers/StorefrontNotifier.php';
        $client = $this->apiClientModel->getById($id);
        if (!$client || empty($client->revalidate_url) || empty($client->revalidate_secret)) {
            $this->error('Save the website address and secret first.', 400);
        }
        $problem = StorefrontNotifier::urlProblem($client->revalidate_url);
        if ($problem) { $this->error($problem, 400); }
        $r = StorefrontNotifier::test($client->revalidate_url, StorefrontNotifier::unseal($client->revalidate_secret));
        $this->success($r, $r['ok'] ? 'The website answered.' : 'The website did not accept the request.');
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
