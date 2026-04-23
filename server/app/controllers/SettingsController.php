<?php
/**
 * SettingsController - Manages application settings
 */
class SettingsController extends Controller {
    private $settingModel;
    private $systemModel;

    public function __construct() {
        $this->settingModel = $this->model('AccountSetting');
        $this->systemModel = $this->model('SystemSetting');
    }

    // GET /api/settings/accounting
    public function accounting() {
        $this->requireAuth();
        $this->success($this->settingModel->getAll());
    }

    // POST /api/settings/accounting
    public function updateAccounting() {
        $this->requirePermission('accounting.write'); // Or a generic settings.write perm
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) { $this->error('Invalid input'); return; }

        foreach ($data as $key => $value) {
            $this->settingModel->update($key, $value);
        }
        $this->success(null, 'Accounting settings updated');
    }

    // GET /api/settings/system
    public function system() {
        $this->requireAuth();
        $this->success($this->systemModel->getAll());
    }

    // POST /api/settings/system
    public function updateSystem() {
        // Only admin should change system settings
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) { $this->error('Invalid input'); return; }

        foreach ($data as $key => $value) {
            $this->systemModel->update($key, $value);
        }
        $this->success(null, 'System settings updated');
    }

    // POST /api/settings/test-sms
    public function testSms() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $data = json_decode(file_get_contents('php://input'), true);
        $to = $data['phone'] ?? '';
        
        if (empty($to)) {
            $this->error('Test phone number is required');
        }

        require_once __DIR__ . '/../helpers/SmsHelper.php';
        $res = SmsHelper::send($to, 'ServiceBay SMS Test: Your gateway is configured correctly.');
        
        if ($res['status'] === 'success') {
            $this->success($res['data'], 'Test SMS sent successfully');
        } else {
            $this->error($res['message'], 500);
        }
    }

    // POST /api/settings/regenerate-public-key
    public function regeneratePublicApiKey() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Permission denied', 403); }

        $newKey = bin2hex(random_bytes(32));
        $this->systemModel->update('PUBLIC_WEBSITE_API_KEY', $newKey);
        
        $this->success(['key' => $newKey], 'Public API Key regenerated successfully');
    }
}
