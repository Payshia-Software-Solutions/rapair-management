<?php
namespace App\Controllers;

use App\Core\Config;
use App\Core\Controller;
use App\Core\Database;
use App\Services\ProvisioningService;

/**
 * A client connects their own domain (e.g. erp.mycompany.com) to their workspace.
 * They prove they own it with a TXT record, and point it at our host with a CNAME.
 * One custom domain per workspace, on packages that include it.
 */
class DomainController extends Controller {
    private const TXT_PREFIX = '_bizzflow-verify.';

    private function requireClient() {
        if (!isset($_SESSION['admin_id'], $_SESSION['tenant_id'])) {
            $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }
        $db = new Database();
        $db->query("SELECT t.*, p.custom_domain AS plan_custom_domain FROM saas_tenants t
                    LEFT JOIN saas_packages p ON p.id = t.package_id WHERE t.id = :id");
        $db->bind(':id', (int)$_SESSION['tenant_id']);
        $tenant = $db->single();
        if (!$tenant) $this->json(['status' => 'error', 'message' => 'Account not found'], 404);
        return [$db, $tenant];
    }

    private function current(Database $db, $tenantId) {
        $db->query("SELECT * FROM saas_custom_domains WHERE tenant_id = :t ORDER BY id DESC LIMIT 1");
        $db->bind(':t', (int)$tenantId);
        return $db->single();
    }

    private function view($row, $tenant): array {
        return [
            'allowed' => (bool)(int)$tenant->plan_custom_domain,
            'ready' => ($tenant->provision_status ?? '') === 'ready',
            'domain' => $row ? [
                'domain' => $row->domain,
                'status' => $row->status,
                'txt_host' => self::TXT_PREFIX . $row->domain,
                'txt_value' => $row->verify_token,
                'cname_target' => Config::CUSTOM_DOMAIN_TARGET(),
            ] : null,
        ];
    }

    // GET /api/client/domain
    public function show() {
        [$db, $tenant] = $this->requireClient();
        return $this->json(['status' => 'success', 'data' => $this->view($this->current($db, $tenant->id), $tenant)]);
    }

    // POST /api/client/domain/add {domain}
    public function add() {
        [$db, $tenant] = $this->requireClient();
        if (!(int)$tenant->plan_custom_domain) {
            return $this->json(['status' => 'error', 'message' => 'Custom domains are not included in your plan. Upgrade to use one.'], 403);
        }
        if (($tenant->provision_status ?? '') !== 'ready') {
            return $this->json(['status' => 'error', 'message' => 'Your workspace is not ready yet.'], 409);
        }
        if ($this->current($db, $tenant->id)) {
            return $this->json(['status' => 'error', 'message' => 'Remove your current custom domain before adding another.'], 409);
        }

        $data = $this->getPostData() ?: [];
        $domain = strtolower(trim((string)($data['domain'] ?? '')));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = rtrim($domain, '/.');

        if (!preg_match('/^(?=.{4,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/', $domain) || filter_var($domain, FILTER_VALIDATE_IP)) {
            return $this->json(['status' => 'error', 'message' => 'Enter a valid domain such as erp.yourcompany.com.'], 400);
        }
        $appHost = (string)parse_url((string)$tenant->workspace_url, PHP_URL_HOST);
        $base = implode('.', array_slice(explode('.', $appHost), 1));
        if ($base !== '' && ($domain === $base || substr($domain, -strlen('.' . $base)) === '.' . $base)) {
            return $this->json(['status' => 'error', 'message' => 'That domain belongs to the platform. Use your own domain.'], 400);
        }
        $db->query("SELECT id FROM saas_custom_domains WHERE domain = :d LIMIT 1");
        $db->bind(':d', $domain);
        if ($db->single()) {
            return $this->json(['status' => 'error', 'message' => 'That domain is already connected to a workspace.'], 409);
        }

        $db->query("INSERT INTO saas_custom_domains (tenant_id, domain, verify_token) VALUES (:t, :d, :v)");
        $db->bind(':t', (int)$tenant->id);
        $db->bind(':d', $domain);
        $db->bind(':v', 'bizzflow-' . bin2hex(random_bytes(16)));
        $db->execute();

        return $this->json(['status' => 'success', 'data' => $this->view($this->current($db, $tenant->id), $tenant)]);
    }

    // POST /api/client/domain/verify
    public function verify() {
        [$db, $tenant] = $this->requireClient();
        $row = $this->current($db, $tenant->id);
        if (!$row) return $this->json(['status' => 'error', 'message' => 'Add a domain first.'], 400);
        if ($row->status === 'active') {
            return $this->json(['status' => 'success', 'data' => $this->view($row, $tenant)]);
        }
        if (!(int)$tenant->plan_custom_domain) {
            return $this->json(['status' => 'error', 'message' => 'Custom domains are not included in your plan.'], 403);
        }

        $problem = $this->dnsProblem($row->domain, $row->verify_token);
        if ($problem) return $this->json(['status' => 'error', 'message' => $problem], 422);

        try {
            (new ProvisioningService())->setCustomDomain((int)$tenant->id, $row->domain, true);
        } catch (\Throwable $e) {
            error_log('Custom domain connect failed: ' . $e->getMessage());
            return $this->json(['status' => 'error', 'message' => 'The DNS is correct, but the workspace server could not connect the domain. Try again, or contact support.'], 502);
        }
        $db->query("UPDATE saas_custom_domains SET status = 'active', verified_at = NOW() WHERE id = :id");
        $db->bind(':id', (int)$row->id);
        $db->execute();

        return $this->json(['status' => 'success', 'data' => $this->view($this->current($db, $tenant->id), $tenant)]);
    }

    // POST /api/client/domain/remove
    public function remove() {
        [$db, $tenant] = $this->requireClient();
        $row = $this->current($db, $tenant->id);
        if (!$row) return $this->json(['status' => 'success', 'data' => $this->view(null, $tenant)]);

        if ($row->status === 'active') {
            try {
                (new ProvisioningService())->setCustomDomain((int)$tenant->id, $row->domain, false);
            } catch (\Throwable $e) {
                error_log('Custom domain removal failed: ' . $e->getMessage());
                return $this->json(['status' => 'error', 'message' => 'The workspace server could not disconnect the domain. Try again, or contact support.'], 502);
            }
        }
        $db->query("DELETE FROM saas_custom_domains WHERE id = :id");
        $db->bind(':id', (int)$row->id);
        $db->execute();

        return $this->json(['status' => 'success', 'data' => $this->view(null, $tenant)]);
    }

    /** Null when the DNS is right, otherwise what is missing. */
    private function dnsProblem(string $domain, string $token): ?string {
        if (!Config::CUSTOM_DOMAIN_DNS_CHECK()) return null;
        $target = strtolower(rtrim(Config::CUSTOM_DOMAIN_TARGET(), '.'));
        if ($target === '') return 'Custom domains are not set up on this server yet. Contact support.';

        // 1) Ownership: TXT record holding the token
        $owned = false;
        foreach ((array)@dns_get_record(self::TXT_PREFIX . $domain, DNS_TXT) as $r) {
            if (trim((string)($r['txt'] ?? '')) === $token) { $owned = true; break; }
        }
        if (!$owned) return 'We could not find the TXT record yet. DNS changes can take a few minutes: try again shortly.';

        // 2) Routing: CNAME to our host, or an A record with the same address as our host
        foreach ((array)@dns_get_record($domain, DNS_CNAME) as $r) {
            if (strtolower(rtrim((string)($r['target'] ?? ''), '.')) === $target) return null;
        }
        $mine = (array)@gethostbynamel($target);
        $theirs = array_column((array)@dns_get_record($domain, DNS_A), 'ip');
        if ($mine && array_intersect($mine, $theirs)) return null;
        return "The domain does not point to $target yet. Add the CNAME record and try again.";
    }
}
