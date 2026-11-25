<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Database;

/**
 * Maintenance mode for the whole ERP: one switch that closes every workspace at once.
 * Stored in saas_settings (maintenance_on, maintenance_message, maintenance_until). Each ERP API
 * asks GET /api/saas/maintenance (cached there for 30 seconds), so a switch takes effect within that time.
 */
class MaintenanceController extends Controller {
    const KEYS = ['maintenance_on', 'maintenance_message', 'maintenance_until'];
    const DEFAULT_MESSAGE = 'We are carrying out scheduled maintenance. BizzFlow will be back shortly.';

    /** Public: what every ERP install checks. */
    public function status() {
        header('Cache-Control: no-store');
        return $this->json(['status' => 'success', 'data' => self::read()]);
    }

    public function get() {
        $this->requireSuperAdmin();
        return $this->json(['status' => 'success', 'data' => self::read()]);
    }

    public function update() {
        $this->requireSuperAdmin();
        $d = $this->getPostData() ?: [];
        $on = !empty($d['on']);
        $message = trim(mb_substr((string)($d['message'] ?? ''), 0, 500));
        $until = trim((string)($d['until'] ?? ''));
        if ($until !== '') {
            $t = strtotime($until);
            if ($t === false) return $this->json(['status' => 'error', 'message' => 'The end time is not a valid date.'], 422);
            $until = date('Y-m-d H:i', $t);
        }
        self::save(['maintenance_on' => $on ? '1' : '0', 'maintenance_message' => $message, 'maintenance_until' => $until]);
        return $this->json([
            'status' => 'success',
            'message' => $on ? 'Maintenance mode is on. Workspaces close within 30 seconds.' : 'Maintenance mode is off. Workspaces reopen within 30 seconds.',
            'data' => self::read(),
        ]);
    }

    public static function read() {
        $db = new Database();
        $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key IN ('maintenance_on','maintenance_message','maintenance_until')");
        $v = [];
        foreach ($db->resultSet() as $r) $v[$r->setting_key] = (string)$r->setting_value;
        return [
            'on' => ($v['maintenance_on'] ?? '0') === '1',
            'message' => ($v['maintenance_message'] ?? '') !== '' ? $v['maintenance_message'] : self::DEFAULT_MESSAGE,
            'custom_message' => $v['maintenance_message'] ?? '',
            'until' => ($v['maintenance_until'] ?? '') ?: null,
        ];
    }

    private static function save(array $values) {
        foreach ($values as $k => $val) {
            $db = new Database();
            $db->query("SELECT setting_key FROM saas_settings WHERE setting_key = :k");
            $db->bind(':k', $k);
            $exists = (bool)$db->single();
            $db = new Database();
            $db->query($exists ? "UPDATE saas_settings SET setting_value = :v WHERE setting_key = :k"
                               : "INSERT INTO saas_settings (setting_key, setting_value) VALUES (:k, :v)");
            $db->bind(':k', $k);
            $db->bind(':v', $val);
            $db->execute();
        }
    }

    private function requireSuperAdmin() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }
}
