<?php
/**
 * SaasHelper
 * Manages tenant packages and module access.
 */
class SaasHelper {
    private static $config = null;
    private static $cache_ttl = 3600;

    public static function getConfig($force = false) {
        if (!$force && self::$config !== null) return self::$config;
        if (!$force) {
            self::$config = self::getCache();
            if (self::$config) return self::$config;
        }

        try {
            $masterApiUrl = NEXUS_PORTAL_URL . "/api/saas/license/check?key=" . NEXUS_API_KEY;
            $ctx = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
            $json = @file_get_contents($masterApiUrl, false, $ctx);
            
            if ($json) {
                $response = json_decode($json, true);
                if (isset($response['status']) && $response['status'] === 'success') {
                    self::$config = $response['data'];
                    self::$config['api_connected'] = true;
                    self::setCache(self::$config);
                }
            }

            if (!self::$config) {
                self::$config = [
                    'name' => 'Restricted', 
                    'modules' => ['serviceCenter', 'promotions', 'frontOffice'],
                    'api_connected' => false
                ];
            }
        } catch (Exception $e) {
            error_log("Nexus Connection Error: " . $e->getMessage());
            self::$config = [
                'name' => 'Restricted', 
                'modules' => ['serviceCenter', 'promotions', 'frontOffice'],
                'api_connected' => false
            ];
        }
        return self::$config;
    }

    public static function syncConfig() {
        self::clearCache();
        return self::getConfig(true);
    }

    public static function getPackages() {
        try {
            $masterApiUrl = NEXUS_PORTAL_URL . "/api/saas/packages";
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
            $json = @file_get_contents($masterApiUrl, false, $ctx);
            if ($json) {
                $response = json_decode($json, true);
                if (isset($response['status']) && $response['status'] === 'success') {
                    return $response['data'];
                }
            }
        } catch (Exception $e) {
            error_log("Nexus Packages Error: " . $e->getMessage());
        }
        return [];
    }

    private static function clearCache() {
        $file = APPROOT . '/scratch/nexus_license.json';
        if (file_exists($file)) @unlink($file);
        self::$config = null;
    }

    public static function isModuleEnabled($module) {
        $config = self::getConfig();
        if (isset($config['status']) && $config['status'] === 'Trial') {
            if (isset($config['trial_expiry']) && strtotime($config['trial_expiry']) < time()) return false;
        }
        if (isset($config['modules']) && in_array('*', $config['modules'])) return true;
        return isset($config['modules']) && in_array($module, $config['modules']);
    }

    public static function requireModule($module) {
        if (!self::isModuleEnabled($module)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode([
                'status' => 'error',
                'message' => "The '{$module}' module is not included in your current subscription. Please contact Nexus Support to upgrade."
            ]);
            exit;
        }
    }

    private static function getCache() {
        $file = APPROOT . '/scratch/nexus_license.json';
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true);
            if (time() - ($data['ts'] ?? 0) < self::$cache_ttl) return $data['data'];
        }
        return null;
    }

    private static function setCache($data) {
        $file = APPROOT . '/scratch/nexus_license.json';
        @file_put_contents($file, json_encode(['ts' => time(), 'data' => $data]));
    }
}
