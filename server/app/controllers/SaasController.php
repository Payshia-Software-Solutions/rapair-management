<?php
/**
 * SaasController
 * Public API to check SaaS configuration.
 */
class SaasController extends Controller {
    public function config() {
        $config = SaasHelper::getConfig();
        $this->success($config);
    }

    public function sync() {
        $config = SaasHelper::syncConfig();
        $this->success($config);
    }

    public function packages() {
        $packages = SaasHelper::getPackages();
        $this->success($packages);
    }

    public function update_license() {
        // Only Admin allowed
        $u = $this->requireAuth();
        if (($u['role'] ?? '') !== 'Admin') {
            $this->error('Forbidden', 403);
            return;
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $key = $data['license_key'] ?? '';

        if (empty($key)) {
            $this->error('License key is required', 400);
            return;
        }

        try {
            $db = new Database();
            $db->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES ('nexus_api_key', :val)");
            $db->bind(':val', $key);
            if ($db->execute()) {
                // Clear SaaS cache to reflect changes immediately
                $file = APPROOT . '/scratch/nexus_license.json';
                if (file_exists($file)) @unlink($file);
                
                $this->success(null, 'License key updated successfully');
            } else {
                $this->error('Failed to update license key');
            }
        } catch (Exception $e) {
            $this->error('Database error: ' . $e->getMessage());
        }
    }
}
