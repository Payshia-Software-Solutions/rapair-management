<?php
/**
 * Push device registration for the mobile apps.
 *   POST /api/device/register     { token, app?, platform?, device_name? }  (call after login and on token refresh)
 *   POST /api/device/unregister   { token }                                  (call on logout)
 */
require_once '../app/helpers/DeviceSchema.php';

class DeviceController extends Controller {

    private function input(): array {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method not allowed', 405);
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    public function register() {
        $u = $this->requireAuth();
        $in = $this->input();
        $token = trim((string)($in['token'] ?? ''));
        if ($token === '' || strlen($token) > 255) $this->error('A valid device token is required.', 422);
        $app = preg_replace('/[^a-z0-9_-]/', '', strtolower((string)($in['app'] ?? 'mgmt'))) ?: 'mgmt';
        $platform = in_array(($in['platform'] ?? ''), ['android', 'ios'], true) ? $in['platform'] : 'android';
        $name = mb_substr(trim((string)($in['device_name'] ?? '')), 0, 120) ?: null;

        DeviceSchema::ensure();
        $db = new Database();
        // A token moves to whoever signed in last on that device.
        $db->query("INSERT INTO device_tokens (user_id, token, app, platform, device_name) VALUES (:u, :t, :a, :p, :n)
                    ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), app = VALUES(app), platform = VALUES(platform),
                    device_name = VALUES(device_name), last_seen_at = CURRENT_TIMESTAMP");
        $db->bind(':u', (int)$u['sub']); $db->bind(':t', $token); $db->bind(':a', $app);
        $db->bind(':p', $platform); $db->bind(':n', $name);
        $db->execute();
        $this->success(null, 'Device registered');
    }

    public function unregister() {
        $u = $this->requireAuth();
        $in = $this->input();
        $token = trim((string)($in['token'] ?? ''));
        if ($token === '') $this->error('Token is required.', 422);
        DeviceSchema::ensure();
        $db = new Database();
        $db->query("DELETE FROM device_tokens WHERE token = :t AND user_id = :u");
        $db->bind(':t', $token); $db->bind(':u', (int)$u['sub']);
        $db->execute();
        $this->success(null, 'Device removed');
    }
}
