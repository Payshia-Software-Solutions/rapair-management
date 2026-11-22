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

    // GET /api/saas/usage  Active users and branches against the plan limits (null = unlimited).
    public function usage() {
        $this->requireAuth();
        SaasHelper::reportUsageThrottled(300);
        $u = SaasHelper::usage();
        $this->success([
            'users' => $u['users'],
            'locations' => $u['locations'],
            'max_users' => SaasHelper::limit('users'),
            'max_locations' => SaasHelper::limit('locations'),
        ]);
    }

    public function packages() {
        $packages = SaasHelper::getPackages();
        if (is_array($packages)) {
            $packages = array_values(array_filter($packages, function($p) {
                $isPublic = isset($p['is_public']) ? intval($p['is_public']) === 1 : true;
                $key = strtolower($p['package_key'] ?? '');
                $name = strtolower($p['name'] ?? '');
                
                if (!$isPublic) return false;
                if ($key === 'custom' || $key === 'free_trial' || strpos($key, 'custom') === 0) return false;
                if (strpos($name, 'custom') === 0 || strpos($name, 'handling fee') !== false) return false;
                return true;
            }));
        }
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
