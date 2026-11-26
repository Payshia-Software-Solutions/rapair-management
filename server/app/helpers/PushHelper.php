<?php
/**
 * Firebase Cloud Messaging (HTTP v1) push to users' registered devices.
 *
 * Config (server/.env):
 *   FCM_SERVICE_ACCOUNT=/absolute/path/to/firebase-service-account.json
 * Unset = push is off and every call is a silent no-op.
 *
 * One Firebase project serves every workspace: tokens live in each workspace's own DB,
 * so a push only ever reaches that workspace's users.
 */
require_once __DIR__ . '/DeviceSchema.php';

class PushHelper {
    private static $account = false;   // false = not loaded yet, null = push off

    private static function account() {
        if (self::$account !== false) return self::$account;
        self::$account = null;
        $path = class_exists('Env') ? Env::get('FCM_SERVICE_ACCOUNT', '') : (getenv('FCM_SERVICE_ACCOUNT') ?: '');
        if (!$path || !is_readable($path)) return null;
        $json = json_decode((string)file_get_contents($path), true);
        if (empty($json['project_id']) || empty($json['client_email']) || empty($json['private_key'])) return null;
        self::$account = $json;
        return $json;
    }

    public static function enabled(): bool { return self::account() !== null; }

    /** OAuth access token for FCM, cached in the temp dir until shortly before expiry. */
    private static function accessToken(array $sa): ?string {
        $cache = sys_get_temp_dir() . '/fcm_token_' . md5($sa['client_email']) . '.json';
        if (is_readable($cache)) {
            $c = json_decode((string)@file_get_contents($cache), true);
            if (!empty($c['token']) && ($c['exp'] ?? 0) > time() + 60) return $c['token'];
        }
        $b64 = fn($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
        $now = time();
        $head = $b64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claims = $b64(json_encode([
            'iss' => $sa['client_email'], 'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $now, 'exp' => $now + 3600,
        ]));
        if (!openssl_sign("$head.$claims", $sig, $sa['private_key'], 'sha256WithRSAEncryption')) return null;
        $jwt = "$head.$claims." . $b64($sig);

        $res = self::http('https://oauth2.googleapis.com/token', [
            'Content-Type: application/x-www-form-urlencoded',
        ], http_build_query(['grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt]));
        $tok = $res['json']['access_token'] ?? null;
        if (!$tok) { error_log('FCM auth failed: ' . $res['body']); return null; }
        @file_put_contents($cache, json_encode(['token' => $tok, 'exp' => $now + (int)($res['json']['expires_in'] ?? 3600)]));
        return $tok;
    }

    private static function http(string $url, array $headers, string $body): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4,
        ]);
        $out = (string)curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['code' => $code, 'body' => $out, 'json' => json_decode($out, true)];
    }

    /**
     * Push to every device of the given users. $data values must be strings (FCM rule).
     * Tokens FCM reports as dead are deleted. Never throws.
     */
    public static function sendToUsers(array $userIds, string $title, string $body, array $data = []): void {
        try {
            $sa = self::account();
            $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
            if (!$sa || !$userIds) return;
            DeviceSchema::ensure();
            $db = new Database();
            $ph = implode(',', array_map(fn($i) => ':u' . $i, array_keys($userIds)));
            $db->query("SELECT id, token FROM device_tokens WHERE user_id IN ($ph)");
            foreach ($userIds as $i => $id) $db->bind(':u' . $i, $id);
            $rows = $db->resultSet() ?: [];
            if (!$rows) return;
            $access = self::accessToken($sa);
            if (!$access) return;

            $data = array_map('strval', $data);
            $url = 'https://fcm.googleapis.com/v1/projects/' . rawurlencode($sa['project_id']) . '/messages:send';
            foreach ($rows as $r) {
                $msg = ['message' => [
                    'token' => $r->token,
                    'notification' => ['title' => $title, 'body' => $body],
                    'android' => ['priority' => 'HIGH', 'notification' => ['channel_id' => 'approvals']],
                ]];
                if ($data) $msg['message']['data'] = $data;
                $res = self::http($url, ['Authorization: Bearer ' . $access, 'Content-Type: application/json'], json_encode($msg));
                $status = $res['json']['error']['status'] ?? '';
                if ($res['code'] === 404 || $status === 'UNREGISTERED' || $status === 'NOT_FOUND') {
                    $db->query("DELETE FROM device_tokens WHERE id = :id");
                    $db->bind(':id', (int)$r->id);
                    $db->execute();
                } elseif ($res['code'] >= 400) {
                    error_log('FCM send failed (' . $res['code'] . '): ' . $res['body']);
                }
            }
        } catch (Throwable $e) {
            error_log('Push failed: ' . $e->getMessage());
        }
    }
}
