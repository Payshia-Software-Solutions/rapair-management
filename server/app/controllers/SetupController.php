<?php
/**
 * SetupController - first-time setup of a new workspace (the Setup wizard).
 *
 *   GET  /api/setup/status      which basics are done (admin only)
 *   POST /api/setup/test_mail   {to} send a test email with the saved mail settings
 *   POST /api/setup/complete    mark setup finished (wizard stops appearing)
 *   POST /api/setup/reopen      show the wizard again
 *
 * "Done" is worked out from the real data, so a step finished on its normal settings page
 * counts too. Optional steps (mail, SMS) can be skipped.
 */
class SetupController extends Controller {

    private function admin() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Only an administrator can run the setup.', 403); }
        return $u;
    }

    private function settings(Database $db) {
        $db->query("SELECT setting_key, setting_value FROM system_settings");
        $out = [];
        foreach ($db->resultSet() ?: [] as $r) $out[$r->setting_key] = $r->setting_value;
        return $out;
    }

    private function count(Database $db, $sql) {
        try { $db->query($sql); return (int)($db->single()->n ?? 0); }
        catch (Exception $e) { return 0; }
    }

    private function saveSetting(Database $db, $key, $value) {
        $db->query("REPLACE INTO system_settings (setting_key, setting_value) VALUES (:k, :v)");
        $db->bind(':k', $key);
        $db->bind(':v', $value);
        $db->execute();
    }

    public function status() {
        $this->admin();
        $db = new Database();
        $s = $this->settings($db);

        $db->query("SELECT name, address, phone FROM company WHERE id = 1");
        $c = $db->single();
        $companyDone = $c && trim((string)$c->name) !== '' && trim((string)$c->address) !== '' && trim((string)$c->phone) !== '';

        $db->query("SELECT address, phone FROM service_locations ORDER BY id LIMIT 1");
        $l = $db->single();
        $locationDone = !empty($s['setup_location_done']) || ($l && trim((string)$l->address) !== '' && trim((string)$l->phone) !== '');

        $steps = [
            'company'  => ['done' => $companyDone, 'required' => true],
            'location' => ['done' => $locationDone, 'required' => true],
            // New workspaces start with VAT/SSCL from the template, so this is "reviewed in the wizard"
            'taxes'    => ['done' => !empty($s['setup_taxes_done']), 'required' => false],
            'mail'     => ['done' => trim((string)($s['mail_host'] ?? '')) !== '', 'required' => false, 'skipped' => !empty($s['setup_mail_skipped'])],
            'sms'      => ['done' => trim((string)($s['sms_gateway_url'] ?? '')) !== '' && trim((string)($s['sms_api_key'] ?? '')) !== '', 'required' => false, 'skipped' => !empty($s['setup_sms_skipped'])],
        ];
        // Things to do after the wizard (shown as a checklist with links)
        $next = [
            'users'  => $this->count($db, "SELECT COUNT(*) n FROM users WHERE is_active = 1") > 1,
            'items'  => $this->count($db, "SELECT COUNT(*) n FROM parts") > 0,
            'tables' => $this->count($db, "SELECT COUNT(*) n FROM restaurant_tables") > 0,
            'printers' => $this->count($db, "SELECT COUNT(*) n FROM printers") > 0,
        ];

        $requiredDone = $companyDone && $locationDone;
        $this->success([
            'completed' => !empty($s['setup_completed']),
            'required_done' => $requiredDone,
            'steps' => $steps,
            'next' => $next,
        ]);
    }

    /** Remembers a step the admin confirmed or skipped (taxes reviewed, mail/SMS skipped, location confirmed). */
    public function mark() {
        $this->admin();
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $allowed = ['setup_taxes_done', 'setup_mail_skipped', 'setup_sms_skipped', 'setup_location_done'];
        $key = (string)($d['key'] ?? '');
        if (!in_array($key, $allowed, true)) { $this->error('Unknown setup step', 400); return; }
        $this->saveSetting(new Database(), $key, !empty($d['value']) ? '1' : '');
        $this->success(null, 'Saved');
    }

    public function test_mail() {
        $this->admin();
        $d = json_decode(file_get_contents('php://input'), true) ?: [];
        $to = trim((string)($d['to'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) { $this->error('Enter a valid email address to send the test to.', 422); return; }
        // Without a server EmailHelper falls back to PHP mail(), which "succeeds" without delivering
        $s = $this->settings(new Database());
        if (trim((string)($s['mail_host'] ?? '')) === '') { $this->error('Save the mail server details first.', 422); return; }
        require_once '../app/helpers/EmailHelper.php';
        try {
            $ok = EmailHelper::send($to, 'BizzFlow test email', '<p>Your outgoing mail server is set up correctly.</p>');
        } catch (Throwable $e) {
            $this->error('Could not send: ' . $e->getMessage(), 500);
            return;
        }
        if ($ok === true || (is_array($ok) && ($ok['status'] ?? '') === 'success')) {
            $this->success(null, 'Test email sent');
        } else {
            $msg = is_array($ok) ? ($ok['message'] ?? 'unknown error') : 'Check the server, port, username and password.';
            $this->error('Could not send the test email. ' . $msg, 500);
        }
    }

    /**
     * GET /api/setup/tour  Getting-started checklist for a new workspace, ticked from real data:
     * setup wizard -> first item -> first POS sale. Ends (and hides) after the first POS sale.
     * POST /api/setup/tour {dismissed: true|false}  hides / shows it again.
     */
    public function tour() {
        $this->admin();
        $db = new Database();
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            $d = json_decode(file_get_contents('php://input'), true) ?: [];
            $this->saveSetting($db, 'tour_dismissed', !empty($d['dismissed']) ? '1' : '');
            $this->success(null, 'Saved');
            return;
        }
        $s = $this->settings($db);
        $sale = !empty($s['tour_first_pos_invoice']) || $this->count($db, "SELECT COUNT(*) n FROM invoices") > 0;
        $items = $this->count($db, "SELECT COUNT(*) n FROM parts");
        $customers = $this->count($db, "SELECT COUNT(*) n FROM customers");
        // The workspace template can ship sample items or a walk-in customer: only rows added after the
        // guide first ran count as "your first item / customer". Baseline saved once.
        if (!isset($s['tour_base_items'])) { $this->saveSetting($db, 'tour_base_items', (string)$items); $s['tour_base_items'] = $items; }
        if (!isset($s['tour_base_customers'])) { $this->saveSetting($db, 'tour_base_customers', (string)$customers); $s['tour_base_customers'] = $customers; }
        $steps = [
            ['key' => 'setup',       'done' => !empty($s['setup_completed'])],
            ['key' => 'units',       'done' => $this->count($db, "SELECT COUNT(*) n FROM units") > 0],
            ['key' => 'brands',      'done' => $this->count($db, "SELECT COUNT(*) n FROM brands") > 0],
            ['key' => 'collections', 'done' => $this->count($db, "SELECT COUNT(*) n FROM collections") > 0],
            ['key' => 'item',        'done' => $items > (int)$s['tour_base_items']],
            // POS only sells an item that has stock, unless it is A La Carte or a Service
            ['key' => 'stock',       'done' => $this->count($db, "SELECT COUNT(*) n FROM parts WHERE stock_quantity > 0 OR recipe_type = 'A La Carte' OR item_type = 'Service'") > 0],
            ['key' => 'customer',    'done' => $customers > (int)$s['tour_base_customers']],
            // POS can't close a bill without a customer: every location needs a default one
            ['key' => 'default_customer', 'done' => $this->count($db, "SELECT COUNT(*) n FROM service_locations") > 0
                && $this->count($db, "SELECT COUNT(*) n FROM service_locations WHERE default_customer_id IS NULL OR default_customer_id = 0") === 0],
            ['key' => 'pos',         'done' => $sale],
        ];
        $this->success([
            'steps' => $steps,
            'finished' => $sale,
            'dismissed' => !empty($s['tour_dismissed']),
        ]);
    }

    public function complete() {
        $this->admin();
        $this->saveSetting(new Database(), 'setup_completed', '1');
        $this->success(null, 'Setup complete');
    }

    public function reopen() {
        $this->admin();
        $this->saveSetting(new Database(), 'setup_completed', '');
        $this->success(null, 'Setup reopened');
    }
}
