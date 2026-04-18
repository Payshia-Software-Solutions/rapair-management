<?php
/**
 * SettingController - Manages application settings
 */
class SettingController extends Controller {
    private $settingModel;

    public function __construct() {
        $this->settingModel = $this->model('AccountSetting');
    }

    // GET /api/settings/accounting
    public function accounting() {
        $this->requireAuth();
        $this->success($this->settingModel->getAll());
    }

    // POST /api/settings/accounting
    public function updateAccounting() {
        $this->requirePermission('accounting.write');
        $data = json_decode(file_get_contents('php://input'), true);

        if (!is_array($data)) {
            $this->error('Invalid input');
            return;
        }

        foreach ($data as $key => $value) {
            $this->settingModel->update($key, $value);
        }

        $this->success(null, 'Settings updated successfully');
    }
}
