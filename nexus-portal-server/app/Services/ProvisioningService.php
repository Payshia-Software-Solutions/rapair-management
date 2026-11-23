<?php
namespace App\Services;

use App\Core\Database;
use App\Core\Mailer;
use App\Models\ProductModel;

/**
 * Tells products about subscription changes, through an outbox (saas_webhook_events).
 *
 * Only for tenants on the SHARED deployment of a product that has a provisioning URL. Dedicated
 * clients and billing-only products are never sent anything, so they work exactly as before.
 *
 * Delivery: signed POST (X-Nexus-Event-Id / X-Nexus-Timestamp / X-Nexus-Signature =
 * HMAC-SHA256("<ts>.<body>", product secret)). Events for one tenant go out in order. Failures are
 * retried with backoff (1m, 5m, 15m, 1h, 3h, 6h, 12h, 24h), then marked failed for an admin to retry.
 * The product dedupes by event id, so a retry after a timeout never runs twice.
 */
class ProvisioningService {
    const BACKOFF = [60, 300, 900, 3600, 10800, 21600, 43200, 86400];

    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /** Workspace name for a Nexus slug (products accept lowercase letters, digits and dashes). */
    public static function workspaceSlug($slug) {
        $s = strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', (string)$slug));
        return trim($s, '-');
    }

    private function tenant($tenantId) {
        $this->db->query("
            SELECT t.*, k.package_key, k.modules AS package_modules, k.product_id
            FROM saas_tenants t LEFT JOIN saas_packages k ON k.id = t.package_id
            WHERE t.id = :id
        ");
        $this->db->bind(':id', (int)$tenantId);
        return $this->db->single();
    }

    /** The product to notify for this tenant, or null when this tenant isn't provisioned automatically. */
    private function productFor($t) {
        if (!$t || ($t->deployment ?? 'dedicated') !== 'shared') return null;
        $p = (new ProductModel())->getForTenant($t->id);
        if (!$p || !(int)$p->is_active || empty($p->provision_url) || empty($p->webhook_secret)) return null;
        return $p;
    }

    private static function modules($t) {
        $m = json_decode((string)($t->package_modules ?? ''), true);
        return is_array($m) ? array_values($m) : [];
    }

    // ---------------------------------------------------------------- events

    /** New workspace for a tenant: switches it to the shared deployment and queues tenant.created. */
    public function provision($tenantId, bool $deliverNow = false) {
        $t = $this->tenant($tenantId);
        if (!$t) throw new \InvalidArgumentException('Tenant not found');
        if ($t->status === 'Deleted') throw new \InvalidArgumentException('Tenant is deleted');
        if (!$t->product_id) throw new \InvalidArgumentException('This tenant\'s package is not linked to a product. Set the product on the package first.');
        if (empty($t->admin_email)) throw new \InvalidArgumentException('The tenant needs an admin email (the login is sent there).');

        $this->db->query("UPDATE saas_tenants SET deployment = 'shared', provision_status = 'pending', provision_error = NULL WHERE id = :id");
        $this->db->bind(':id', (int)$tenantId);
        $this->db->execute();
        $t = $this->tenant($tenantId);
        if (!$this->productFor($t)) {
            throw new \InvalidArgumentException('The product has no provisioning URL/secret yet (Admin -> Products).');
        }

        // A new attempt replaces older setup events still waiting to retry; otherwise the new one would
        // queue behind them ("Waiting for an earlier event") until they finally give up a day later.
        // In-flight ('sending') events are left alone. The product dedupes by event id, and Provisioner
        // resumes an unfinished create, so replacing them is safe.
        $this->db->query("UPDATE saas_webhook_events SET status = 'failed', last_error = CONCAT(COALESCE(last_error, ''), ' [replaced by a newer setup attempt]')
                          WHERE tenant_id = :t AND event_type = 'tenant.created' AND status = 'pending'");
        $this->db->bind(':t', (int)$tenantId);
        $this->db->execute();

        return $this->queue($t, 'tenant.created', [
            'slug' => self::workspaceSlug($t->slug),
            'name' => $t->name,
            'admin_email' => $t->admin_email,
            'admin_name' => $t->name,
            'plan_code' => $t->package_key,
            'modules' => self::modules($t),
            'license_key' => $t->license_key,
            'api_key' => $t->api_key,
            'nexus_tenant_id' => (string)$t->id,
        ], $deliverNow);
    }

    /**
     * Sends one event to the workspace server now and returns its result. Never retried later: if it
     * fails the event is closed, so it cannot apply behind the user's back after they were told it failed.
     */
    private function applyNow($tenantId, string $type, array $data): array {
        $t = $this->tenant($tenantId);
        if (!$t || !$this->productFor($t)) throw new RuntimeException('This workspace is not on the shared deployment.');
        $data['slug'] = self::workspaceSlug($t->slug);
        $id = $this->queue($t, $type, $data, false);
        if ($id && $this->deliver($id)) {
            $this->db->query("SELECT response FROM saas_webhook_events WHERE id = :id");
            $this->db->bind(':id', (int)$id);
            $r = json_decode((string)($this->db->single()->response ?? ''), true);
            return is_array($r) ? $r : [];
        }
        $this->db->query("SELECT last_error FROM saas_webhook_events WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        $err = (string)($this->db->single()->last_error ?? '');
        $this->finish($id, 'failed', null, $err ?: 'Not applied', null);
        throw new RuntimeException($err ?: 'The workspace server did not respond.');
    }

    /** Moves a shared workspace to a new public address and returns the new URL. */
    public function changeAddress($tenantId, string $label) {
        $r = $this->applyNow($tenantId, 'workspace.address_changed', ['label' => $label]);
        if (empty($r['url'])) throw new RuntimeException('The workspace server did not return the new address.');
        return $r['url'];
    }

    /** Connects ($add = true) or disconnects a customer-owned domain on the workspace. */
    public function setCustomDomain($tenantId, string $domain, bool $add): void {
        $this->applyNow($tenantId, $add ? 'domain.added' : 'domain.removed', ['domain' => $domain]);
    }

    /**
     * Call after a tenant is changed. Compares old vs new and queues what changed:
     * plan -> subscription.plan_changed; Suspended <-> Active/Trial -> suspended/resumed; Deleted -> tenant.deleted.
     */
    public function onTenantChanged($old, $tenantId) {
        $t = $this->tenant($tenantId);
        if (!$this->productFor($t) || ($t->provision_status ?? '') === 'none') return;
        $slug = self::workspaceSlug($t->slug);

        if ((string)$old->package_id !== (string)$t->package_id) {
            $this->queue($t, 'subscription.plan_changed', [
                'slug' => $slug, 'plan_code' => $t->package_key, 'modules' => self::modules($t),
                'license_key' => $t->license_key, 'api_key' => $t->api_key,
            ]);
        } elseif ((string)$old->license_key !== (string)$t->license_key || (string)$old->api_key !== (string)$t->api_key) {
            $this->queue($t, 'subscription.plan_changed', [
                'slug' => $slug, 'plan_code' => $t->package_key, 'modules' => self::modules($t),
                'license_key' => $t->license_key, 'api_key' => $t->api_key,
            ]);
        }

        $wasOn = in_array($old->status, ['Active', 'Trial'], true);
        $isOn = in_array($t->status, ['Active', 'Trial'], true);
        if ($t->status === 'Deleted' && $old->status !== 'Deleted') {
            $this->queue($t, 'tenant.deleted', ['slug' => $slug]);
        } elseif ($wasOn && $t->status === 'Suspended') {
            $this->queue($t, 'subscription.suspended', ['slug' => $slug]);
        } elseif ($old->status === 'Suspended' && $isOn) {
            $this->queue($t, 'subscription.resumed', ['slug' => $slug]);
        }
    }

    /** Package edited (modules changed): tell every shared workspace on that package. */
    public function onPackageChanged($packageId) {
        $this->db->query("SELECT id FROM saas_tenants WHERE package_id = :p AND deployment = 'shared' AND provision_status = 'ready' AND status <> 'Deleted'");
        $this->db->bind(':p', (int)$packageId);
        foreach ($this->db->resultSet() as $row) {
            $t = $this->tenant($row->id);
            if (!$this->productFor($t)) continue;
            $this->queue($t, 'subscription.plan_changed', [
                'slug' => self::workspaceSlug($t->slug), 'plan_code' => $t->package_key, 'modules' => self::modules($t),
            ]);
        }
    }

    private function queue($t, $type, array $data, bool $deliverNow = true) {
        $p = $this->productFor($t);
        if (!$p) return null;
        $eventId = 'evt_' . bin2hex(random_bytes(16));
        $this->db->query("INSERT INTO saas_webhook_events (event_id, product_id, tenant_id, event_type, payload, status, next_attempt_at)
                          VALUES (:e, :p, :t, :ty, :pl, 'pending', NOW())");
        $this->db->bind(':e', $eventId);
        $this->db->bind(':p', (int)$p->id);
        $this->db->bind(':t', (int)$t->id);
        $this->db->bind(':ty', $type);
        $this->db->bind(':pl', json_encode(['type' => $type, 'data' => $data]));
        $this->db->execute();
        $id = (int)$this->db->lastInsertId();
        // Try right away unless the caller will drive delivery (progress UI); the cron picks up anything that fails
        if ($deliverNow) $this->deliver($id);
        return $id;
    }

    /**
     * Live workspace details from the product (database host/name/user, domains, status).
     * Signed like a webhook but sent directly and not queued: it only reads. No password comes back.
     */
    public function workspaceInfo($tenantId) {
        $t = $this->tenant($tenantId);
        if (!$t) throw new \InvalidArgumentException('Tenant not found');
        $p = $this->productFor($t);
        if (!$p) throw new \InvalidArgumentException('This tenant has no shared workspace (dedicated install or product not set up).');

        $body = json_encode(['type' => 'tenant.info', 'data' => ['slug' => self::workspaceSlug($t->slug)]]);
        $ts = time();
        $ch = curl_init($p->provision_url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; NexusProvisioner/1.0; +https://nebulync.com)',
            CURLOPT_ENCODING => '',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Nexus-Event-Id: info_' . bin2hex(random_bytes(8)),
                'X-Nexus-Timestamp: ' . $ts,
                'X-Nexus-Signature: ' . hash_hmac('sha256', $ts . '.' . $body, $p->webhook_secret),
            ],
        ]);
        $resp = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = $resp === false ? curl_error($ch) : '';
        curl_close($ch);

        $json = json_decode((string)$resp, true);
        if ($code === 200 && is_array($json) && ($json['status'] ?? '') === 'success') return $json['result'] ?? [];
        if ($err) throw new \RuntimeException("Workspace server unreachable: $err");
        if (is_array($json) && !empty($json['message'])) {
            // An older product version doesn't know tenant.info yet
            if (stripos($json['message'], 'Unknown event type') !== false) {
                throw new \RuntimeException('The workspace server needs updating to show these details (deploy the latest ERP API).');
            }
            throw new \RuntimeException("HTTP $code: " . $json['message']);
        }
        throw new \RuntimeException(self::describeBadReply($code, $resp, $p->provision_url));
    }

    /**
     * Setup progress for the progress screens (client and admin): Nexus side (queued / sending / retrying)
     * plus the real step the workspace server has reached (database, template, schema, seed, domain).
     * The workspace server is only asked while setup is running.
     */
    public function progress($tenantId) {
        $t = $this->tenant($tenantId);
        if (!$t) throw new \InvalidArgumentException('Tenant not found');
        $this->db->query("SELECT id, status, attempts, last_error, last_http_code, next_attempt_at, created_at, sent_at
                          FROM saas_webhook_events WHERE tenant_id = :t AND event_type = 'tenant.created' ORDER BY id DESC LIMIT 1");
        $this->db->bind(':t', (int)$tenantId);
        $e = $this->db->single() ?: null;
        $this->db->query("SELECT NOW() AS now");
        $now = $this->db->single()->now;

        $ps = $t->provision_status ?: 'none';
        $erp = null; $erpError = null;
        if ($ps === 'pending' || $ps === 'failed') {
            try {
                $info = $this->workspaceInfo($tenantId);
                $erp = ['status' => $info['status'] ?? null, 'step' => $info['provision_step'] ?? null, 'last_error' => $info['last_error'] ?? null];
            } catch (\Throwable $x) {
                // "No workspace" = the server has not started on it yet; anything else is worth showing
                if (stripos($x->getMessage(), 'No workspace') === false) $erpError = $x->getMessage();
            }
        }
        // Stuck "sending": the request that carried the setup died before the reply came back (hosting
        // killed it, timeout). Send it again: right away once the workspace server says it is done
        // (it answers instantly then, with a fresh login), otherwise after 6 minutes.
        if ($e && $e->status === 'sending' && $ps === 'pending') {
            $erpDone = $erp && ($erp['status'] ?? '') === 'active';
            $this->db->query("UPDATE saas_webhook_events SET status = 'pending', next_attempt_at = NOW(),
                                     last_error = 'The reply was lost; sending again'
                              WHERE id = :id AND status = 'sending'
                                AND updated_at < NOW() - INTERVAL " . ($erpDone ? "45 SECOND" : "6 MINUTE"));
            $this->db->bind(':id', (int)$e->id);
            $this->db->execute();
        }

        return [
            'provision_status' => $ps,
            'provision_error' => $t->provision_error ?? null,
            'workspace_url' => $t->workspace_url ?? null,
            'now' => $now,
            'event' => $e ? [
                'status' => $e->status,
                'attempts' => (int)$e->attempts,
                'last_error' => $e->last_error,
                'next_attempt_at' => $e->next_attempt_at,
                'created_at' => $e->created_at,
                'sent_at' => $e->sent_at,
            ] : null,
            'erp' => $erp,
            'erp_error' => $erpError,
        ];
    }

    /** True when this tenant's setup event is waiting to be sent and is due (so a page poll can send it). */
    public function setupDue($tenantId) {
        $this->db->query("SELECT COUNT(*) AS n FROM saas_webhook_events WHERE tenant_id = :t AND status = 'pending'
                          AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())");
        $this->db->bind(':t', (int)$tenantId);
        return (int)$this->db->single()->n > 0;
    }

    // ---------------------------------------------------------------- delivery

    /** Sends everything that is due (cron: scripts/deliver_webhooks.php). Returns [sent, failed]. */
    public function deliverDue($limit = 50) {
        // Oldest first, and never ahead of an earlier undelivered event for the same tenant
        $this->db->query("
            SELECT e.id FROM saas_webhook_events e
            WHERE e.status = 'pending' AND (e.next_attempt_at IS NULL OR e.next_attempt_at <= NOW())
              AND NOT EXISTS (SELECT 1 FROM saas_webhook_events x
                              WHERE x.tenant_id = e.tenant_id AND x.id < e.id AND x.status IN ('pending','sending'))
            ORDER BY e.id LIMIT " . (int)$limit);
        $sent = 0; $failed = 0;
        foreach ($this->db->resultSet() as $row) {
            $this->deliver((int)$row->id) ? $sent++ : $failed++;
        }
        // A delivery that crashed mid-way ("sending" for 7+ minutes; the longest request times out at 5) goes back in the queue
        $this->db->query("UPDATE saas_webhook_events SET status = 'pending' WHERE status = 'sending' AND updated_at < NOW() - INTERVAL 7 MINUTE");
        $this->db->execute();
        return [$sent, $failed];
    }

    /** Admin "retry" on a failed event. */
    public function retry($eventId) {
        $this->db->query("UPDATE saas_webhook_events SET status = 'pending', next_attempt_at = NOW(), attempts = 0 WHERE id = :id AND status IN ('failed','pending')");
        $this->db->bind(':id', (int)$eventId);
        $this->db->execute();
        return $this->deliver((int)$eventId);
    }

    /** One delivery attempt. Returns true when the product accepted the event. */
    public function deliver($id) {
        // Claim it (another worker may be on it)
        $this->db->query("UPDATE saas_webhook_events SET status = 'sending', attempts = attempts + 1 WHERE id = :id AND status = 'pending'");
        $this->db->bind(':id', (int)$id);
        $this->db->execute();
        if ($this->db->rowCount() !== 1) return false;

        $this->db->query("SELECT e.*, p.provision_url, p.webhook_secret FROM saas_webhook_events e
                          INNER JOIN saas_products p ON p.id = e.product_id WHERE e.id = :id");
        $this->db->bind(':id', (int)$id);
        $e = $this->db->single();

        // Earlier event for this tenant still undelivered: wait (keeps events in order)
        $this->db->query("SELECT COUNT(*) AS n FROM saas_webhook_events WHERE tenant_id = :t AND id < :id AND status IN ('pending','sending')");
        $this->db->bind(':t', (int)$e->tenant_id);
        $this->db->bind(':id', (int)$id);
        if ((int)$this->db->single()->n > 0) {
            $this->finish($id, 'pending', null, 'Waiting for an earlier event for this tenant', null, 60, true);
            return false;
        }

        $body = $e->payload;
        $ts = time();
        $sig = hash_hmac('sha256', $ts . '.' . $body, $e->webhook_secret);
        $ch = curl_init($e->provision_url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => $e->event_type === 'tenant.created' ? 300 : 60,
            // Shared-hosting firewalls (ModSecurity / Imunify360) answer "406 Not Acceptable" to requests
            // without a browser-like User-Agent and Accept header, before the product's PHP ever runs
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; NexusProvisioner/1.0; +https://nebulync.com)',
            CURLOPT_ENCODING => '', // send Accept-Encoding and decode the reply
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-Nexus-Event-Id: ' . $e->event_id,
                'X-Nexus-Timestamp: ' . $ts,
                'X-Nexus-Signature: ' . $sig,
            ],
        ]);
        $resp = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = $resp === false ? curl_error($ch) : null;
        curl_close($ch);

        $json = is_string($resp) ? json_decode($resp, true) : null;
        $ok = $code >= 200 && $code < 300 && is_array($json) && ($json['status'] ?? '') === 'success';

        if ($ok) {
            $result = $json['result'] ?? [];
            // Never keep the one-time admin password
            $stored = $result;
            if (is_array($stored)) unset($stored['admin_password']);
            $this->finish($id, 'sent', $code, null, json_encode($stored));
            $this->afterSuccess($e, is_array($result) ? $result : []);
            return true;
        }

        $msg = $err ?: (is_array($json) && !empty($json['message']) ? "HTTP $code: " . $json['message'] : self::describeBadReply($code, $resp, $e->provision_url));
        // 4xx (bad signature, unknown event, invalid data) won't fix itself: stop retrying
        $permanent = $code >= 400 && $code < 500 && $code !== 408 && $code !== 429;
        $attempt = (int)$e->attempts;
        if ($permanent || $attempt >= count(self::BACKOFF)) {
            $this->finish($id, 'failed', $code ?: null, $msg, is_string($resp) ? mb_substr($resp, 0, 4000) : null);
            $this->afterFailure($e, $msg);
        } else {
            $this->finish($id, 'pending', $code ?: null, $msg, is_string($resp) ? mb_substr($resp, 0, 4000) : null, self::BACKOFF[$attempt - 1] ?? 3600);
        }
        return false;
    }

    /** A reply that is not the product's JSON (web server error page, PHP error, empty body): say what it was. */
    private static function describeBadReply($code, $resp, $url) {
        $text = is_string($resp) ? $resp : '';
        $title = preg_match('/<title>(.*?)<\/title>/is', $text, $m) ? trim(html_entity_decode($m[1])) : '';
        $plain = trim(preg_replace('/\s+/', ' ', strip_tags(preg_replace('/<(style|script)\b.*?<\/\1>/is', '', $text))));
        $snippet = mb_substr($title ?: $plain, 0, 200);
        if ($code === 404) {
            return "HTTP 404: the provisioning URL was not found ($url). Check Admin -> Products -> Provisioning URL.";
        }
        if ($code === 0) return "No reply from $url";
        if ($code === 406 || $code === 403 && stripos($snippet, 'forbidden') !== false) {
            return "HTTP $code: blocked by the workspace server's firewall (ModSecurity/Imunify360) before PHP ran. "
                . "Turn ModSecurity off for that domain in cPanel, or whitelist /provision.php.";
        }
        if ($snippet === '') return "HTTP $code with an empty reply (check the workspace server's error log / logs/provision.log)";
        return "HTTP $code (not a JSON reply): $snippet";
    }

    private function finish($id, $status, $code, $error, $response, $retryIn = null, $undoAttempt = false) {
        $this->db->query("UPDATE saas_webhook_events SET status = :s, last_http_code = :c, last_error = :e, response = :r,
                          next_attempt_at = " . ($retryIn ? "NOW() + INTERVAL " . (int)$retryIn . " SECOND" : "next_attempt_at") . ",
                          sent_at = " . ($status === 'sent' ? "NOW()" : "sent_at") .
                          ($undoAttempt ? ", attempts = GREATEST(attempts - 1, 0)" : "") . " WHERE id = :id");
        $this->db->bind(':s', $status);
        $this->db->bind(':c', $code);
        $this->db->bind(':e', $error);
        $this->db->bind(':r', $response);
        $this->db->bind(':id', (int)$id);
        $this->db->execute();
    }

    private function afterSuccess($e, array $result) {
        if ($e->event_type !== 'tenant.created' || !$e->tenant_id) return;
        $this->db->query("UPDATE saas_tenants SET provision_status = 'ready', provision_error = NULL, workspace_url = :u WHERE id = :id");
        $this->db->bind(':u', $result['url'] ?? null);
        $this->db->bind(':id', (int)$e->tenant_id);
        $this->db->execute();

        // Welcome email with the login (the password is only ever in this email)
        if (!empty($result['admin_password'])) {
            $this->db->query("SELECT name, admin_email, billing_cc_email FROM saas_tenants WHERE id = :id");
            $this->db->bind(':id', (int)$e->tenant_id);
            $t = $this->db->single();
            if ($t && $t->admin_email) {
                $url = htmlspecialchars($result['url'] ?? '');
                $email = htmlspecialchars($result['admin_email'] ?? $t->admin_email);
                $pw = htmlspecialchars($result['admin_password']);
                $body = "<h2 style='margin:0 0 12px'>Your workspace is ready</h2>"
                    . "<p>Hello " . htmlspecialchars($t->name) . ",</p>"
                    . "<p>Your BizzFlow workspace has been created. Sign in with:</p>"
                    . "<table style='border-collapse:collapse;margin:12px 0'>"
                    . "<tr><td style='padding:4px 12px 4px 0;color:#64748b'>Address</td><td><a href='$url'>$url</a></td></tr>"
                    . "<tr><td style='padding:4px 12px 4px 0;color:#64748b'>Email</td><td>$email</td></tr>"
                    . "<tr><td style='padding:4px 12px 4px 0;color:#64748b'>Temporary password</td><td><code>$pw</code></td></tr>"
                    . "</table><p>Please change the password after your first sign-in.</p>";
                $sent = false;
                try { $sent = Mailer::sendCustomEmail($t->admin_email, $t->name, 'Your BizzFlow workspace is ready', $body); }
                catch (\Throwable $x) { error_log('Welcome email: ' . $x->getMessage()); }
                // Log without the password
                (new \App\Models\TenantModel())->logEmail(null, 'Workspace Ready', $t->admin_email, null, $sent ? 'Sent' : 'Failed',
                    $sent ? null : 'Could not send welcome email', 'Your BizzFlow workspace is ready', null);
            }
        }
    }

    private function afterFailure($e, $msg) {
        if ($e->event_type !== 'tenant.created' || !$e->tenant_id) return;
        $this->db->query("UPDATE saas_tenants SET provision_status = 'failed', provision_error = :m WHERE id = :id");
        $this->db->bind(':m', mb_substr($msg, 0, 2000));
        $this->db->bind(':id', (int)$e->tenant_id);
        $this->db->execute();
    }

    // ---------------------------------------------------------------- admin views

    /** Latest delivery event for a tenant (drives the provisioning progress bar). */
    public function latestEvent($tenantId) {
        $this->db->query("SELECT id, event_type, status, attempts, last_http_code, last_error, sent_at, created_at
                          FROM saas_webhook_events WHERE tenant_id = :t ORDER BY id DESC LIMIT 1");
        $this->db->bind(':t', (int)$tenantId);
        return $this->db->single() ?: null;
    }

    public function events($tenantId = null, $limit = 100) {
        $this->db->query("
            SELECT e.id, e.event_id, e.event_type, e.status, e.attempts, e.next_attempt_at, e.last_http_code, e.last_error,
                   e.sent_at, e.created_at, t.name AS tenant_name, t.slug AS tenant_slug, p.name AS product_name
            FROM saas_webhook_events e
            LEFT JOIN saas_tenants t ON t.id = e.tenant_id
            LEFT JOIN saas_products p ON p.id = e.product_id
            " . ($tenantId ? "WHERE e.tenant_id = :t" : "") . "
            ORDER BY e.id DESC LIMIT " . (int)$limit);
        if ($tenantId) $this->db->bind(':t', (int)$tenantId);
        return $this->db->resultSet();
    }
}
