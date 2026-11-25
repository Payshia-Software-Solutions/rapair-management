<?php
/**
 * Maintenance mode for every workspace at once, switched in the Nexus portal (Settings → Maintenance).
 * The answer is cached in scratch/maintenance.json for 30 seconds and shared by all tenants on this
 * server, so it costs one Nexus call per 30 seconds, not one per request. If Nexus cannot be reached,
 * the last known answer is kept (never "on" forever: a stale "on" older than 15 minutes is dropped).
 */
class Maintenance {
    const TTL = 30;
    const STALE_ON_LIMIT = 900;
    /** Requests that must still work while closed (payment gateway callbacks). */
    const EXEMPT = ['payment/payhere_notify'];

    public static function status() {
        $file = APPROOT . '/scratch/maintenance.json';
        $c = is_file($file) ? json_decode((string)@file_get_contents($file), true) : null;
        $age = is_array($c) ? time() - (int)($c['ts'] ?? 0) : PHP_INT_MAX;
        if (is_array($c) && $age < self::TTL) return $c;

        $ctx = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true,
            'header' => "Accept: application/json\r\nUser-Agent: Mozilla/5.0 (compatible; BizzFlowAPI/1.0)\r\n"]]);
        $json = @file_get_contents(NEXUS_PORTAL_URL . '/api/saas/maintenance', false, $ctx);
        $r = $json ? json_decode($json, true) : null;
        if (($r['status'] ?? '') !== 'success' || !is_array($r['data'] ?? null)) {
            if (is_array($c) && (empty($c['on']) || $age < self::STALE_ON_LIMIT)) return $c;
            return ['on' => false];
        }
        $c = [
            'ts' => time(),
            'on' => !empty($r['data']['on']),
            'message' => mb_substr((string)($r['data']['message'] ?? ''), 0, 500),
            'until' => $r['data']['until'] ?? null,
        ];
        if (!is_dir(dirname($file))) @mkdir(dirname($file), 0750, true);
        @file_put_contents($file, json_encode($c), LOCK_EX);
        return $c;
    }

    /** Called from public/index.php before routing: answers 503 for every API call while on. */
    public static function guard() {
        if (PHP_SAPI === 'cli' || !defined('NEXUS_PORTAL_URL')) return;
        $path = trim((string)($_GET['url'] ?? ''), '/');
        $path = preg_replace('#^api/#', '', $path);
        if (in_array($path, self::EXEMPT, true)) return;

        $s = self::status();
        if (empty($s['on'])) return;
        http_response_code(503);
        header('Retry-After: 120');
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'error',
            'code' => 'maintenance',
            'message' => $s['message'] ?: 'BizzFlow is under maintenance. Please try again shortly.',
            'until' => $s['until'] ?? null,
        ]);
        exit;
    }
}
