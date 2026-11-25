<?php
/**
 * SaasHelper
 * Manages tenant packages and module access.
 */
class SaasHelper {
    private static $config = null;
    private static $cache_ttl = 3600;
    private static $apiKey = null;

    public static function getApiKey() {
        if (self::$apiKey !== null) return self::$apiKey;
        try {
            // Using a raw PDO connection to avoid potential circular dependencies if Database class is complex
            $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME, DB_USER, DB_PASS);
            $stmt = $pdo->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'nexus_api_key' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_OBJ);
            if ($row && !empty($row->setting_value)) {
                self::$apiKey = $row->setting_value;
                return self::$apiKey;
            }
        } catch (Exception $e) {}
        
        if (defined('NEXUS_API_KEY') && !empty(NEXUS_API_KEY)) {
            self::$apiKey = NEXUS_API_KEY;
            return self::$apiKey;
        }
        if (defined('NEXUS_LICENSE_KEY') && !empty(NEXUS_LICENSE_KEY)) {
            self::$apiKey = NEXUS_LICENSE_KEY;
            return self::$apiKey;
        }
        self::$apiKey = '';
        return '';
    }

    public static function getConfig($force = false) {
        if (!$force && self::$config !== null) return self::$config;
        if (!$force) {
            self::$config = self::getCache();
            if (self::$config) return self::$config;
        }

        try {
            $apiKey = self::getApiKey();
            $masterApiUrl = NEXUS_PORTAL_URL . "/api/saas/license/check?key=" . $apiKey;
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

            // Shared deployment: Nexus unreachable -> the plan modules it last sent us (registry)
            if (!self::$config && class_exists('Tenancy', false) && Tenancy::modules() !== null) {
                self::$config = [
                    'name' => (Tenancy::current()['plan_code'] ?? '') ?: 'Subscription',
                    'modules' => Tenancy::modules(),
                    'api_connected' => false
                ];
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
        $file = class_exists('Tenancy', false) ? Tenancy::scratchPath('nexus_license.json') : APPROOT . '/scratch/nexus_license.json';
        if (file_exists($file)) @unlink($file);
        self::$config = null;
    }

    /**
     * True when the workspace is on a trial whose end date has passed.
     * The trial runs through the end of its expiry day (Asia/Colombo, as the rest of the app).
     */
    public static function trialEnded() {
        $config = self::getConfig();
        if (!is_array($config) || strtolower((string)($config['status'] ?? '')) !== 'trial') return false;
        $expiry = trim((string)($config['trial_expiry'] ?? ''));
        if ($expiry === '') return false;
        $end = strtotime($expiry);
        if ($end === false) return false;
        return time() >= $end + 86400;
    }

    /**
     * Plan limit for 'users' or 'locations'. null = unlimited (no limit set, 999+, or the plan is
     * unknown because Nexus is unreachable, so a Nexus outage never blocks a paying customer).
     */
    public static function limit($what) {
        $config = self::getConfig();
        $key = $what === 'users' ? 'max_users' : 'max_locations';
        if (!is_array($config) || !isset($config[$key])) return null;
        $n = (int)$config[$key];
        return ($n < 1 || $n >= 999) ? null : $n;
    }

    /** Current usage: active users and locations. */
    public static function usage() {
        $db = new Database();
        $db->query("SELECT COUNT(*) AS c FROM users WHERE is_active = 1");
        $users = (int)($db->single()->c ?? 0);
        $db->query("SELECT COUNT(*) AS c FROM service_locations");
        $locations = (int)($db->single()->c ?? 0);
        return ['users' => $users, 'locations' => $locations];
    }

    /**
     * Error message when adding one more of 'users' or 'locations' would pass the plan limit,
     * otherwise null. $extra is how many are being added (default 1).
     */
    public static function limitError($what, $extra = 1) {
        $max = self::limit($what);
        if ($max === null) return null;
        $used = self::usage()[$what];
        if ($used + $extra <= $max) return null;
        $label = $what === 'users' ? 'active users' : 'branches';
        return "Your plan allows {$max} {$label} and you already have {$used}. Upgrade your plan to add more.";
    }

    /** Pushes current usage to Nexus so the client portal can show it. Never throws; short timeout. */
    public static function reportUsage() {
        try {
            $key = self::getApiKey();
            if ($key === '' || !defined('NEXUS_PORTAL_URL')) return;
            $body = json_encode(self::usage());
            $ctx = stream_context_create(['http' => [
                'method' => 'POST', 'timeout' => 3, 'ignore_errors' => true,
                'header' => "Content-Type: application/json\r\n", 'content' => $body,
            ]]);
            @file_get_contents(NEXUS_PORTAL_URL . '/api/saas/usage-report?key=' . urlencode($key), false, $ctx);
        } catch (Throwable $e) {
            error_log('Usage report failed: ' . $e->getMessage());
        }
    }

    /** reportUsage() at most once per $seconds, so login and page loads keep Nexus current without a call every time. */
    public static function reportUsageThrottled($seconds = 3600) {
        $file = class_exists('Tenancy', false) ? Tenancy::scratchPath('usage_reported_at') : APPROOT . '/scratch/usage_reported_at';
        $last = file_exists($file) ? (int)@file_get_contents($file) : 0;
        if (time() - $last < $seconds) return;
        @file_put_contents($file, (string)time());
        self::reportUsage();
    }

    public static function isModuleEnabled($module) {
        $config = self::getConfig();
        if (isset($config['status']) && $config['status'] === 'Trial') {
            if (isset($config['trial_expiry']) && strtotime($config['trial_expiry']) < time()) return false;
        }
        if (!isset($config['modules']) || !is_array($config['modules'])) return false;
        if (in_array('*', $config['modules'])) return true;
        if (in_array($module, $config['modules'])) return true;

        $aliases = [
            'fleet' => ['fleet', 'serviceCenter'],
            'serviceCenter' => ['fleet', 'serviceCenter'],
            'marketing' => ['marketing', 'promotions'],
            'promotions' => ['marketing', 'promotions'],
            'crm' => ['crm', 'cms'],
            'cms' => ['crm', 'cms'],
            'ecommerce' => ['ecommerce', 'storefront'],
            'frontOffice' => ['frontOffice', 'hotel'],
            'accounting' => ['accounting', 'finance'],
        ];

        if (isset($aliases[$module])) {
            foreach ($aliases[$module] as $alias) {
                if (in_array($alias, $config['modules'])) return true;
            }
        }

        return false;
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

    /**
     * Developer mode for this workspace, switched in Nexus. Cached for 60 seconds only, so a switch
     * shows within a minute (at once on the shared deployment, where Nexus clears this file).
     */
    public static function devMode() {
        $file = class_exists('Tenancy', false) ? Tenancy::scratchPath('dev_mode.json') : APPROOT . '/scratch/dev_mode.json';
        $c = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
        if (is_array($c) && time() - (int)($c['ts'] ?? 0) < 60) return (bool)$c['on'];

        $on = false;
        $key = self::getApiKey();
        if ($key) {
            $ctx = stream_context_create(['http' => ['timeout' => 5, 'ignore_errors' => true]]);
            $json = @file_get_contents(NEXUS_PORTAL_URL . '/api/saas/license/check?key=' . urlencode($key), false, $ctx);
            $r = $json ? json_decode($json, true) : null;
            if (($r['status'] ?? '') !== 'success') {
                // Nexus unreachable: keep the last known answer rather than flipping the menu
                return is_array($c) ? (bool)$c['on'] : false;
            }
            $on = (int)($r['data']['dev_mode'] ?? 0) === 1;
        }
        @file_put_contents($file, json_encode(['ts' => time(), 'on' => $on]));
        return $on;
    }

    private static function getCache() {
        $file = class_exists('Tenancy', false) ? Tenancy::scratchPath('nexus_license.json') : APPROOT . '/scratch/nexus_license.json';
        if (file_exists($file)) {
            $content = @file_get_contents($file);
            if ($content === false) return null;
            $data = json_decode($content, true);
            if (time() - ($data['ts'] ?? 0) < self::$cache_ttl) return $data['data'];
        }
        return null;
    }

    private static function setCache($data) {
        $file = class_exists('Tenancy', false) ? Tenancy::scratchPath('nexus_license.json') : APPROOT . '/scratch/nexus_license.json';
        @file_put_contents($file, json_encode(['ts' => time(), 'data' => $data]));
    }
}
