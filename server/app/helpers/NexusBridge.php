<?php
namespace App\Helpers;

/**
 * NexusBridge
 * 
 * Handles communication between the local ERP system and the Nexus Master Portal.
 */
class NexusBridge {
    private static $instance = null;
    private $licenseData = null;

    private function __construct() {
        // Load license from cache if available, or fetch fresh
        $this->licenseData = $this->getCachedLicense();
    }

    public static function getInstance() {
        if (self::$instance == null) {
            self::$instance = new NexusBridge();
        }
        return self::$instance;
    }

    /**
     * Verify the license with Nexus Master Portal
     */
    public function verifyLicense($forceRefresh = false) {
        if ($this->licenseData && !$forceRefresh) {
            return $this->licenseData;
        }

        $url = NEXUS_PORTAL_URL . "/api/saas/license/check?key=" . NEXUS_API_KEY;
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200) {
            $data = json_decode($response, true);
            if ($data['status'] === 'success') {
                $this->licenseData = $data['data'];
                $this->cacheLicense($this->licenseData);
                return $this->licenseData;
            }
        }

        return false;
    }

    /**
     * Check if a specific module is active
     */
    public function isModuleActive($moduleId) {
        $data = $this->verifyLicense();
        if (!$data) return false;

        // Check trial expiry
        if (isset($data['status']) && $data['status'] === 'Trial') {
            if (isset($data['trial_expiry']) && strtotime($data['trial_expiry']) < time()) {
                return false; // Trial expired
            }
        }

        $modules = $data['modules'] ?? [];
        return in_array($moduleId, $modules);
    }

    /**
     * Get list of active services
     */
    public function getActiveServices() {
        $data = $this->verifyLicense();
        return $data['services'] ?? [];
    }

    private function cacheLicense($data) {
        // For simplicity, we use a local file cache. 
        // In production, this should be in the database or Redis.
        $cachePath = APPROOT . '/scratch/license_cache.json';
        file_put_contents($cachePath, json_encode([
            'timestamp' => time(),
            'data' => $data
        ]));
    }

    private function getCachedLicense() {
        $cachePath = APPROOT . '/scratch/license_cache.json';
        if (file_exists($cachePath)) {
            $cache = json_decode(file_get_contents($cachePath), true);
            // Cache valid for 1 hour
            if (time() - $cache['timestamp'] < 3600) {
                return $cache['data'];
            }
        }
        return null;
    }
}
