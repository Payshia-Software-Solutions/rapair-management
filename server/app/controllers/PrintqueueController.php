<?php
/**
 * Print queue: tablets / other terminals send kitchen tickets through the server;
 * the BizzFlow Printer app on the kitchen PC collects and prints them.
 *
 *   Tablet  --enqueue_kot-->  server (print_jobs)  <--claim / complete--  kitchen PC printer app
 *
 * Kitchen PCs authenticate with a device key (X-Device-Key), not a user login.
 * Ticket HTML is rendered when the KOT is sent, so a retry prints exactly what was sent.
 */
class PrintqueueController extends Controller {
    const MAX_ATTEMPTS = 3;
    const STALE_CLAIM_SECONDS = 60;   // a job "printing" this long without an answer is retried

    protected $db;

    public function __construct() {
        $this->db = new Database();
    }

    // ------------------------------------------------------------------ helpers

    private function requireAdminUser() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Admins only', 403); }
        return $u;
    }

    private function body() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    private function deviceFromRequest() {
        $key = $_SERVER['HTTP_X_DEVICE_KEY'] ?? '';
        if (strlen($key) < 20) { $this->error('Device key required', 401); }
        $this->db->query("SELECT * FROM print_devices WHERE key_hash = :h AND is_active = 1 LIMIT 1");
        $this->db->bind(':h', hash('sha256', $key));
        $dev = $this->db->single();
        if (!$dev) { $this->error('Unknown or revoked device key', 401); }
        $this->db->query("UPDATE print_devices SET last_seen_at = NOW() WHERE id = :id");
        $this->db->bind(':id', $dev->id);
        $this->db->execute();
        return $dev;
    }

    private function esc($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

    /** Same compact layout as the web KOT (cms/pos/kot/[id]). */
    private function renderKot($order, $items, $voids, $full, $label = 'KOT', $stationName = '') {
        $label = $label !== '' ? $label : 'KOT';
        $merged = [];
        foreach ($items as $it) {
            $mods = [];
            if (!empty($it->modifiers_json)) { $m = json_decode($it->modifiers_json, true); if (is_array($m)) $mods = $m; }
            $notes = (string)($it->item_notes ?? '');
            $key = ($it->item_id ?? $it->description) . '|' . $notes . '|' . implode(',', $mods);
            if (isset($merged[$key])) { $merged[$key]['qty'] += (float)$it->quantity; continue; }
            $merged[$key] = ['name' => $it->description, 'qty' => (float)$it->quantity, 'notes' => $notes, 'mods' => $mods];
        }
        $fmtQty = function ($q) { return rtrim(rtrim(number_format((float)$q, 3, '.', ''), '0'), '.'); };
        $type = strtoupper(str_replace('_', ' ', $order->order_type ?: 'retail'));
        $time = date('H:i');

        $h = '<!doctype html><html><head><meta charset="utf-8"><style>'
           . '@page{size:80mm auto;margin:1mm 2mm}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;color:#000;font-size:13px;line-height:1.25}'
           . '.row{display:flex;justify-content:space-between;align-items:baseline}.hr{border-top:1px dashed #000;margin:3px 0}'
           . '.it{display:flex;gap:6px;padding:2px 0}.q{font-size:14px;font-weight:700;min-width:24px}.n{font-size:14px;font-weight:700}'
           . '.m{font-size:13px;font-weight:800}.note{font-size:12px;font-style:italic;font-weight:700}.small{font-size:11px}.void .q,.void .n{text-decoration:line-through}'
           . '</style></head><body><div class="kot">';
        $h .= '<div class="row" style="font-weight:900"><span style="font-size:15px">' . $this->esc($full ? $label . ' REPRINT' : $label) . ' #' . (int)$order->id . '</span>'
            . '<span style="font-size:15px">' . ($order->table_name ? 'T: ' . $this->esc($order->table_name) : $this->esc($type)) . '</span></div>';
        $h .= '<div class="row small"><span>' . $time . ($order->table_name ? ' · ' . $this->esc($type) : '') . '</span>'
            . '<span>' . $this->esc($order->steward_name ?? '') . '</span></div><div class="hr"></div>';

        foreach ($merged as $m) {
            $h .= '<div class="it"><span class="q">' . $fmtQty($m['qty']) . 'x</span><div style="flex:1"><div class="n">' . $this->esc($m['name']) . '</div>';
            foreach ($m['mods'] as $mod) $h .= '<div class="m">&gt; ' . $this->esc($mod) . '</div>';
            if ($m['notes'] !== '') $h .= '<div class="note">** ' . $this->esc($m['notes']) . '</div>';
            $h .= '</div></div>';
        }

        if (!empty($voids)) {
            $h .= '<div class="hr"></div><div style="font-size:13px;font-weight:900;letter-spacing:1px">*** CANCELLED ***</div>';
            foreach ($voids as $v) {
                $h .= '<div class="void"><div class="it"><span class="q">' . $fmtQty($v->quantity) . 'x</span><span class="n">' . $this->esc($v->description) . '</span></div>'
                    . '<div class="small" style="padding-left:32px">' . ($v->reason ? $this->esc($v->reason) . ' · ' : '')
                    . 'By ' . $this->esc($v->removed_by_name ?: '—') . ' · Appr: ' . $this->esc($v->approved_by_name ?: '—') . '</div></div>';
            }
        }
        if (!empty($order->notes)) $h .= '<div style="font-size:12px;font-weight:700;margin-top:2px">NOTE: ' . $this->esc($order->notes) . '</div>';

        $qtyTotal = 0; foreach ($merged as $m) $qtyTotal += $m['qty'];
        $h .= '<div class="hr"></div><div class="row small"><span>' . count($merged) . ' items · ' . $fmtQty($qtyTotal) . ' qty</span>'
            . '<span>' . $this->esc(trim($stationName . ($full ? ' · REPRINT' : ''), ' ·')) . '</span></div>';
        $h .= '</div></body></html>';
        return $h;
    }

    private function locationStations($locationId) {
        require_once '../app/helpers/PrintStationHelper.php';
        return PrintStationHelper::locationStations($this->db, $locationId);
    }

    private function groupByStation($locationId, $items, $voids) {
        require_once '../app/helpers/PrintStationHelper.php';
        return PrintStationHelper::group($this->db, $locationId, $items, $voids);
    }

    // ------------------------------------------------------------------ POS side (user login)

    // POST /api/printqueue/enqueue_kot { held_order_id, full }
    public function enqueue_kot() {
        $u = $this->requirePermission(['pos.write', 'orders.write']);
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $orderId = (int)($d['held_order_id'] ?? 0);
        $full = !empty($d['full']);
        if ($orderId <= 0) { $this->error('Held order required', 400); return; }

        require_once '../app/models/PosHeldOrder.php';
        $model = new PosHeldOrder();
        $order = $model->getById($orderId);
        if (!$order) { $this->error('Held order not found', 404); return; }

        $items = $full ? ($order->items ?? []) : $model->getUnprintedKOTItems($orderId);
        $voids = $model->getVoids($orderId, !$full);
        if (count($items) + count($voids) === 0) {
            $this->success(['queued' => false, 'reason' => 'nothing_new'], 'Nothing new for the kitchen');
            return;
        }

        // Split by print station (Kitchen / Bar / ...): one ticket per station that has something.
        $onlyStation = isset($d['station_id']) && $d['station_id'] !== '' && $d['station_id'] !== null ? (int)$d['station_id'] : null;
        $groups = $this->groupByStation((int)$order->location_id, $items, $voids);
        $jobIds = [];
        foreach ($groups as $g) {
            if ($onlyStation !== null && (int)($g['station']->id ?? 0) !== $onlyStation) continue;
            $st = $g['station'];
            $label = $st ? ($st->ticket_label ?: 'KOT') : 'KOT';
            $html = $this->renderKot($order, $g['items'], $g['voids'], $full, $label, $st ? $st->name : '');
            $this->db->query("
                INSERT INTO print_jobs (location_id, printer_role, station_id, doc_type, ref_id, title, html, created_by)
                VALUES (:loc, 'KOT', :st, 'kot', :ref, :title, :html, :by)
            ");
            $this->db->bind(':loc', (int)$order->location_id);
            $this->db->bind(':st', $st ? (int)$st->id : null);
            $this->db->bind(':ref', $orderId);
            $this->db->bind(':title', $label . ($full ? ' reprint #' : ' #') . $orderId . ($st ? ' · ' . $st->name : ''));
            $this->db->bind(':html', $html);
            $this->db->bind(':by', (int)$u['sub']);
            $this->db->execute();
            $jobIds[] = (int)$this->db->lastInsertId();
        }
        if (!$jobIds) { $this->success(['queued' => false, 'reason' => 'nothing_new'], 'Nothing new for this station'); return; }

        // The ticket content is now fixed in the jobs, so the items count as sent.
        if (!$full) $model->markAsPrinted($orderId);

        $this->success(['queued' => true, 'job_id' => $jobIds[0], 'job_ids' => $jobIds, 'tickets' => count($jobIds), 'items' => count($items), 'cancelled' => count($voids)], 'Sent to kitchen');
    }

    // GET /api/printqueue/job_status?ids=1,2
    public function job_status() {
        $this->requireAuth();
        $ids = array_values(array_filter(array_map('intval', explode(',', (string)($_GET['ids'] ?? '')))));
        if (!$ids) { $this->success([]); return; }
        $ids = array_slice($ids, 0, 50);
        $in = implode(',', $ids);
        $this->db->query("SELECT id, status, attempts, error FROM print_jobs WHERE id IN ($in)");
        $this->success($this->db->resultSet());
    }

    // GET /api/printqueue/location_status -> waiting / failed jobs and whether a kitchen PC is online
    public function location_status() {
        $u = $this->requireAuth();
        $loc = $this->currentLocationId($u);
        $this->db->query("
            SELECT
              SUM(status IN ('pending','printing') AND created_at < (NOW() - INTERVAL 20 SECOND)) AS waiting,
              SUM(status = 'failed' AND created_at > (NOW() - INTERVAL 12 HOUR)) AS failed
            FROM print_jobs WHERE location_id = :loc
        ");
        $this->db->bind(':loc', $loc);
        $s = $this->db->single();
        $this->db->query("SELECT COUNT(*) AS n FROM print_devices WHERE location_id = :loc AND is_active = 1 AND last_seen_at > (NOW() - INTERVAL 30 SECOND)");
        $this->db->bind(':loc', $loc);
        $online = (int)($this->db->single()->n ?? 0);
        $this->success(['waiting' => (int)($s->waiting ?? 0), 'failed' => (int)($s->failed ?? 0), 'devices_online' => $online]);
    }

    // GET /api/printqueue/failed -> recent failed jobs for this location (to retry)
    public function failed() {
        $u = $this->requireAuth();
        $this->db->query("SELECT id, title, attempts, error, created_at FROM print_jobs WHERE location_id = :loc AND status = 'failed' AND created_at > (NOW() - INTERVAL 12 HOUR) ORDER BY id DESC LIMIT 20");
        $this->db->bind(':loc', $this->currentLocationId($u));
        $this->success($this->db->resultSet());
    }

    // GET /api/printqueue/jobs?status=open|failed|done|all -> this location's recent tickets (POS print queue panel)
    public function jobs() {
        $u = $this->requireAuth();
        $status = (string)($_GET['status'] ?? 'all');
        $where = "j.location_id = :loc AND j.created_at > (NOW() - INTERVAL 24 HOUR)";
        if ($status === 'open') $where .= " AND j.status IN ('pending','printing')";
        elseif (in_array($status, ['failed', 'done', 'cancelled'], true)) $where .= " AND j.status = '" . $status . "'";
        // ?station=ID (Kitchen / Bar ...) or ?station=none (tickets sent before stations existed)
        $st = (string)($_GET['station'] ?? '');
        if ($st === 'none') $where .= ' AND j.station_id IS NULL';
        elseif ((int)$st > 0) $where .= ' AND j.station_id = ' . (int)$st;
        $this->db->query("
            SELECT j.id, j.station_id, j.title, j.status, j.attempts, j.error, j.created_at, j.claimed_at, j.done_at, j.ref_id,
                   s.name AS station_name, s.ticket_label, d.name AS device_name, u.name AS created_by_name
            FROM print_jobs j
            LEFT JOIN print_stations s ON s.id = j.station_id
            LEFT JOIN print_devices d ON d.id = j.claimed_by
            LEFT JOIN users u ON u.id = j.created_by
            WHERE $where
            ORDER BY j.id DESC
            LIMIT 60
        ");
        $this->db->bind(':loc', $this->currentLocationId($u));
        $this->success($this->db->resultSet() ?: []);
    }

    // POST /api/printqueue/cancel/{id} -> stop a ticket that is waiting or failed (it won't print)
    public function cancel($id = null) {
        $u = $this->requirePermission(['pos.checkout', 'pos.void', 'orders.write']);
        $this->db->query("UPDATE print_jobs SET status = 'cancelled', claim_token = NULL, error = :e
                          WHERE id = :id AND location_id = :loc AND status IN ('pending','failed')");
        $this->db->bind(':e', 'Cancelled by user #' . (int)$u['sub']);
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':loc', $this->currentLocationId($u));
        $this->db->execute();
        if ($this->db->rowCount() === 0) { $this->error('Only waiting or failed tickets can be cancelled', 409); return; }
        $this->success(null, 'Ticket cancelled');
    }

    // POST /api/printqueue/retry/{id}
    public function retry($id = null) {
        $this->requirePermission(['pos.write', 'orders.write']);
        $this->db->query("UPDATE print_jobs SET status = 'pending', attempts = 0, error = NULL, claim_token = NULL WHERE id = :id AND status = 'failed'");
        $this->db->bind(':id', (int)$id);
        $this->db->execute();
        $this->success(null, 'Queued again');
    }

    // ------------------------------------------------------------------ kitchen PC (device key)

    // GET /api/printqueue/claim  -> up to 5 jobs for this device's location, with printer + paper width
    public function claim() {
        $dev = $this->deviceFromRequest();
        $token = bin2hex(random_bytes(16));
        $this->db->query("
            UPDATE print_jobs
            SET status = 'printing', claim_token = :t, claimed_by = :dev, claimed_at = NOW(), attempts = attempts + 1
            WHERE location_id = :loc
              AND (station_id IS NULL OR station_id IN (SELECT id FROM print_stations WHERE device_id IS NULL OR device_id = :dev2))
              AND (status = 'pending' OR (status = 'printing' AND claimed_at < (NOW() - INTERVAL " . self::STALE_CLAIM_SECONDS . " SECOND)))
            ORDER BY id ASC
            LIMIT 5
        ");
        $this->db->bind(':t', $token);
        $this->db->bind(':dev', (int)$dev->id);
        $this->db->bind(':dev2', (int)$dev->id);
        $this->db->bind(':loc', (int)$dev->location_id);
        $this->db->execute();

        $this->db->query("SELECT id, printer_role, station_id, title, html, attempts FROM print_jobs WHERE claim_token = :t ORDER BY id ASC");
        $this->db->bind(':t', $token);
        $jobs = $this->db->resultSet();

        // Printer for each role (Settings -> Printers); prefer this location, fall back to any.
        $this->db->query("SELECT printer_type, printer_name, paper_width, location_id FROM printer_settings ORDER BY (location_id = :loc) DESC, id ASC");
        $this->db->bind(':loc', (int)$dev->location_id);
        $map = [];
        foreach ($this->db->resultSet() as $p) { if (!isset($map[$p->printer_type])) $map[$p->printer_type] = $p; }
        $stations = [];
        foreach ($this->locationStations((int)$dev->location_id) as $st) $stations[(int)$st->id] = $st;
        foreach ($jobs as $j) {
            $p = $map[$j->printer_role] ?? null;
            $st = $j->station_id ? ($stations[(int)$j->station_id] ?? null) : null;
            // Station printer wins; a station without a printer uses the role printer (Settings -> Printers)
            $j->printer = ($st && $st->printer_name) ? $st->printer_name : ($p ? $p->printer_name : null);
            $j->width = ($st && $st->printer_name) ? ($st->paper_width ?: '80mm') : ($p && $p->paper_width ? $p->paper_width : '80mm');
        }
        $this->success(['device' => $dev->name, 'jobs' => $jobs]);
    }

    // POST /api/printqueue/report_printers { printers: [names] }  (printer app, every few minutes)
    public function report_printers() {
        $dev = $this->deviceFromRequest();
        $d = $this->body();
        $names = array_values(array_unique(array_filter(array_map(function ($n) { return trim(mb_substr((string)$n, 0, 255)); }, (array)($d['printers'] ?? [])))));
        $this->db->query("UPDATE print_devices SET printers_json = :p WHERE id = :id");
        $this->db->bind(':p', json_encode(array_slice($names, 0, 100)));
        $this->db->bind(':id', (int)$dev->id);
        $this->db->execute();
        $this->success(['count' => count($names)]);
    }

    // GET /api/printqueue/device_stations  (printer app) -> stations this PC prints for
    public function device_stations() {
        $dev = $this->deviceFromRequest();
        $this->db->query("
            SELECT s.id, s.name, s.ticket_label, s.printer_name, s.paper_width, s.is_default, s.device_id,
                   (SELECT COUNT(*) FROM parts p WHERE p.print_station_id = s.id) AS item_count
            FROM print_stations s
            WHERE s.location_id = :l AND s.is_active = 1 AND (s.device_id IS NULL OR s.device_id = :d)
            ORDER BY s.is_default DESC, s.name
        ");
        $this->db->bind(':l', (int)$dev->location_id);
        $this->db->bind(':d', (int)$dev->id);
        $this->success(['device' => $dev->name, 'stations' => $this->db->resultSet() ?: []]);
    }

    // POST /api/printqueue/device_station_printer { station_id, printer_name, paper_width }
    // Lets the kitchen PC pick the printer for a station from its own installed printers.
    public function device_station_printer() {
        $dev = $this->deviceFromRequest();
        $d = $this->body();
        $sid = (int)($d['station_id'] ?? 0);
        $this->db->query("SELECT id FROM print_stations WHERE id = :id AND location_id = :l AND (device_id IS NULL OR device_id = :d)");
        $this->db->bind(':id', $sid); $this->db->bind(':l', (int)$dev->location_id); $this->db->bind(':d', (int)$dev->id);
        if (!$this->db->single()) { $this->error('Station not found for this device', 404); return; }
        $printer = trim(mb_substr((string)($d['printer_name'] ?? ''), 0, 255)) ?: null;
        $width = ($d['paper_width'] ?? '80mm') === '58mm' ? '58mm' : '80mm';
        $this->db->query("UPDATE print_stations SET printer_name = :p, paper_width = :w WHERE id = :id");
        $this->db->bind(':p', $printer); $this->db->bind(':w', $width); $this->db->bind(':id', $sid);
        $this->db->execute();
        $this->success(null, 'Station printer saved');
    }

    // POST /api/printqueue/complete/{id} { success, error }
    public function complete($id = null) {
        $dev = $this->deviceFromRequest();
        $d = $this->body();
        $ok = !empty($d['success']);
        $this->db->query("SELECT id, attempts FROM print_jobs WHERE id = :id AND claimed_by = :dev AND status = 'printing' LIMIT 1");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':dev', (int)$dev->id);
        $job = $this->db->single();
        if (!$job) { $this->error('Job not claimed by this device', 409); return; }

        if ($ok) {
            $this->db->query("UPDATE print_jobs SET status = 'done', done_at = NOW(), error = NULL WHERE id = :id");
        } else {
            $final = (int)$job->attempts >= self::MAX_ATTEMPTS;
            $this->db->query("UPDATE print_jobs SET status = :s, error = :e, claim_token = NULL WHERE id = :id");
            $this->db->bind(':s', $final ? 'failed' : 'pending');
            $this->db->bind(':e', mb_substr((string)($d['error'] ?? 'Print failed'), 0, 255));
        }
        $this->db->bind(':id', (int)$id);
        $this->db->execute();
        $this->success(null);
    }

    // ------------------------------------------------------------------ admin: kitchen print devices

    // GET /api/printqueue/devices
    public function devices() {
        $this->requireAdminUser();
        $this->db->query("
            SELECT d.id, d.name, d.location_id, sl.name AS location_name, d.key_hint, d.is_active, d.last_seen_at, d.created_at, d.printers_json,
                   (d.last_seen_at > (NOW() - INTERVAL 30 SECOND)) AS online
            FROM print_devices d LEFT JOIN service_locations sl ON sl.id = d.location_id
            ORDER BY d.is_active DESC, d.id DESC
        ");
        $this->success($this->db->resultSet());
    }

    // POST /api/printqueue/create_device { name, location_id } -> key shown ONCE
    public function create_device() {
        $u = $this->requireAdminUser();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $name = trim(mb_substr((string)($d['name'] ?? ''), 0, 120));
        $loc = (int)($d['location_id'] ?? 0);
        if ($name === '' || $loc <= 0) { $this->error('Name and location are required', 422); return; }
        $key = 'bfp_' . bin2hex(random_bytes(24));
        $this->db->query("INSERT INTO print_devices (location_id, name, key_hash, key_hint, created_by) VALUES (:l, :n, :h, :hint, :by)");
        $this->db->bind(':l', $loc);
        $this->db->bind(':n', $name);
        $this->db->bind(':h', hash('sha256', $key));
        $this->db->bind(':hint', substr($key, -6));
        $this->db->bind(':by', (int)$u['sub']);
        $this->db->execute();
        $this->success(['id' => (int)$this->db->lastInsertId(), 'key' => $key], 'Device created');
    }

    // POST /api/printqueue/revoke_device/{id}
    public function revoke_device($id = null) {
        $this->requireAdminUser();
        $this->db->query("UPDATE print_devices SET is_active = 0 WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        $this->db->execute();
        $this->success(null, 'Device revoked');
    }

    // ------------------------------------------------------------------ print stations (Kitchen / Bar / ...)

    // GET /api/printqueue/stations?location_id=1
    public function stations() {
        $this->requireAuth();
        $loc = (int)($_GET['location_id'] ?? 0);
        $sql = "SELECT s.*, d.name AS device_name,
                       (SELECT COUNT(*) FROM parts p WHERE p.print_station_id = s.id) AS item_count
                FROM print_stations s LEFT JOIN print_devices d ON d.id = s.device_id"
             . ($loc > 0 ? " WHERE s.location_id = :l" : "") . " ORDER BY s.location_id, s.is_default DESC, s.name";
        $this->db->query($sql);
        if ($loc > 0) $this->db->bind(':l', $loc);
        $this->success($this->db->resultSet() ?: []);
    }

    // POST /api/printqueue/save_station { id?, location_id, name, ticket_label, device_id, printer_name, paper_width, is_default, is_active }
    public function save_station() {
        $this->requireAdminUser();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $id = (int)($d['id'] ?? 0);
        $loc = (int)($d['location_id'] ?? 0);
        $name = trim(mb_substr((string)($d['name'] ?? ''), 0, 100));
        $label = strtoupper(trim(mb_substr((string)($d['ticket_label'] ?? 'KOT'), 0, 20))) ?: 'KOT';
        $device = (int)($d['device_id'] ?? 0) ?: null;
        $printer = trim(mb_substr((string)($d['printer_name'] ?? ''), 0, 255)) ?: null;
        $width = ($d['paper_width'] ?? '80mm') === '58mm' ? '58mm' : '80mm';
        $isDefault = !empty($d['is_default']) ? 1 : 0;
        $active = array_key_exists('is_active', $d) ? (!empty($d['is_active']) ? 1 : 0) : 1;
        if ($name === '' || $loc <= 0) { $this->error('Name and location are required', 422); return; }

        // First station of a location becomes its default automatically
        $this->db->query("SELECT COUNT(*) AS c FROM print_stations WHERE location_id = :l AND id <> :id");
        $this->db->bind(':l', $loc); $this->db->bind(':id', $id);
        if ((int)$this->db->single()->c === 0) $isDefault = 1;
        if ($isDefault) {
            $this->db->query("UPDATE print_stations SET is_default = 0 WHERE location_id = :l");
            $this->db->bind(':l', $loc); $this->db->execute();
        }
        if ($id > 0) {
            $this->db->query("UPDATE print_stations SET location_id=:l, name=:n, ticket_label=:t, device_id=:d, printer_name=:p, paper_width=:w, is_default=:def, is_active=:a WHERE id=:id");
            $this->db->bind(':id', $id);
        } else {
            $this->db->query("INSERT INTO print_stations (location_id, name, ticket_label, device_id, printer_name, paper_width, is_default, is_active) VALUES (:l,:n,:t,:d,:p,:w,:def,:a)");
        }
        $this->db->bind(':l', $loc); $this->db->bind(':n', $name); $this->db->bind(':t', $label);
        $this->db->bind(':d', $device); $this->db->bind(':p', $printer); $this->db->bind(':w', $width);
        $this->db->bind(':def', $isDefault); $this->db->bind(':a', $active);
        $this->db->execute();
        $this->success(['id' => $id > 0 ? $id : (int)$this->db->lastInsertId()], 'Station saved');
    }

    // POST /api/printqueue/delete_station/{id}  (its items fall back to the default station)
    public function delete_station($id = null) {
        $this->requireAdminUser();
        $id = (int)$id;
        $this->db->query("UPDATE parts SET print_station_id = NULL WHERE print_station_id = :id");
        $this->db->bind(':id', $id); $this->db->execute();
        $this->db->query("DELETE FROM print_stations WHERE id = :id");
        $this->db->bind(':id', $id); $this->db->execute();
        $this->success(null, 'Station deleted');
    }

    // GET /api/printqueue/station_items?q=&station=all|none|{id}&page=1
    public function station_items() {
        $this->requireAdminUser();
        $q = trim((string)($_GET['q'] ?? ''));
        $st = (string)($_GET['station'] ?? 'all');
        $page = max(1, (int)($_GET['page'] ?? 1)); $per = 50;
        $where = ["p.is_active = 1"];
        if ($q !== '') $where[] = "(p.part_name LIKE :q1 OR p.sku LIKE :q2 OR p.barcode_number LIKE :q3)";
        if ($st === 'none') $where[] = "p.print_station_id IS NULL";
        elseif ($st !== 'all' && (int)$st > 0) $where[] = "p.print_station_id = " . (int)$st;
        $cat = (int)($_GET['category'] ?? 0);
        if ($cat > 0) $where[] = "p.item_category_id = " . $cat;
        $col = (int)($_GET['collection'] ?? 0);
        if ($col > 0) $where[] = "EXISTS (SELECT 1 FROM parts_collections pc WHERE pc.part_id = p.id AND pc.collection_id = " . $col . ")";
        $w = implode(' AND ', $where);
        $this->db->query("SELECT COUNT(*) AS c FROM parts p WHERE $w");
        if ($q !== '') { foreach ([":q1", ":q2", ":q3"] as $k) $this->db->bind($k, "%" . $q . "%"); }
        $total = (int)$this->db->single()->c;
        if (!empty($_GET['ids_only'])) {
            $this->db->query("SELECT p.id FROM parts p WHERE $w ORDER BY p.part_name LIMIT 5000");
            if ($q !== '') { foreach ([":q1", ":q2", ":q3"] as $k) $this->db->bind($k, "%" . $q . "%"); }
            $this->success(['ids' => array_map(function ($r) { return (int)$r->id; }, $this->db->resultSet() ?: []), 'total' => $total]);
            return;
        }
        $this->db->query("SELECT p.id, p.part_name, p.sku, p.item_type, p.print_station_id FROM parts p WHERE $w ORDER BY p.part_name LIMIT $per OFFSET " . (($page - 1) * $per));
        if ($q !== '') { foreach ([":q1", ":q2", ":q3"] as $k) $this->db->bind($k, "%" . $q . "%"); }
        $this->success(['items' => $this->db->resultSet() ?: [], 'total' => $total, 'page' => $page, 'per_page' => $per]);
    }

    // GET /api/printqueue/item_filters -> categories + collections for the assign dialog
    public function item_filters() {
        $this->requireAdminUser();
        $cats = []; $cols = [];
        try { $this->db->query("SELECT id, name FROM item_categories ORDER BY name"); $cats = $this->db->resultSet() ?: []; } catch (Exception $e) {}
        try { $this->db->query("SELECT id, name FROM collections ORDER BY name"); $cols = $this->db->resultSet() ?: []; } catch (Exception $e) {}
        $this->success(['categories' => $cats, 'collections' => $cols]);
    }

    // POST /api/printqueue/assign_items { station_id: id|null, item_ids: [..] }
    public function assign_items() {
        $this->requireAdminUser();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        $d = $this->body();
        $ids = array_values(array_filter(array_map('intval', (array)($d['item_ids'] ?? []))));
        if (!$ids) { $this->error('Select items first', 422); return; }
        $sid = (int)($d['station_id'] ?? 0) ?: null;
        $this->db->query("UPDATE parts SET print_station_id = :s WHERE id IN (" . implode(',', $ids) . ")");
        $this->db->bind(':s', $sid);
        $this->db->execute();
        $this->success(['updated' => count($ids)], 'Items updated');
    }
}
