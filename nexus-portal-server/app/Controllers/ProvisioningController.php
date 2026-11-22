<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\ProductModel;
use App\Services\ProvisioningService;

/**
 * Admin: products, automatic workspace provisioning, and the webhook outbox.
 *
 *   GET  api/admin/products                    list
 *   POST api/admin/products/save               {id?, product_key, name, description, provision_url, webhook_secret?, workspace_domain, is_active}
 *   POST api/admin/products/delete             {id}
 *   POST api/admin/packages/set-product        {package_id, product_id|null}
 *   POST api/admin/tenants/provision           {id}   create the tenant's workspace on the shared deployment
 *   GET  api/admin/webhooks?tenant_id=         outbox (latest 100)
 *   POST api/admin/webhooks/retry              {id}
 *   POST api/admin/webhooks/run                deliver everything due now (same as the cron)
 */
class ProvisioningController extends Controller {

    private function checkAuth() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }

    private function fail(\Throwable $e) {
        $bad = $e instanceof \InvalidArgumentException;
        if (!$bad) error_log('Provisioning: ' . $e->getMessage());
        return $this->json(['status' => 'error', 'message' => $bad ? $e->getMessage() : 'Something went wrong: ' . $e->getMessage()], $bad ? 400 : 500);
    }

    public function listProducts() {
        $this->checkAuth();
        return $this->json(['status' => 'success', 'data' => (new ProductModel())->getAll()]);
    }

    public function saveProduct() {
        $this->checkAuth();
        try {
            (new ProductModel())->save($this->getPostData() ?: []);
            return $this->json(['status' => 'success', 'message' => 'Product saved']);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function deleteProduct() {
        $this->checkAuth();
        try {
            (new ProductModel())->delete((int)(($this->getPostData() ?: [])['id'] ?? 0));
            return $this->json(['status' => 'success', 'message' => 'Product deleted']);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function setPackageProduct() {
        $this->checkAuth();
        $d = $this->getPostData() ?: [];
        try {
            (new ProductModel())->setPackageProduct((int)($d['package_id'] ?? 0), $d['product_id'] ?? null);
            return $this->json(['status' => 'success', 'message' => 'Package updated']);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    public function provisionTenant() {
        $this->checkAuth();
        $id = (int)(($this->getPostData() ?: [])['id'] ?? 0);
        set_time_limit(400);
        try {
            $svc = new ProvisioningService();
            $eventId = $svc->provision($id);
            $t = (new \App\Models\TenantModel())->getByIdWithPackage($id);
            return $this->json(['status' => 'success', 'data' => [
                'event_id' => $eventId,
                'provision_status' => $t->provision_status ?? null,
                'workspace_url' => $t->workspace_url ?? null,
                'provision_error' => $t->provision_error ?? null,
            ]]);
        } catch (\Throwable $e) { return $this->fail($e); }
    }

    // GET /api/admin/tenants/provision-status?id=  (polled by the progress dialog)
    public function provisionStatus() {
        $this->checkAuth();
        $id = (int)($_GET['id'] ?? 0);
        $t = (new \App\Models\TenantModel())->getByIdWithPackage($id);
        if (!$t) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);
        $event = (new ProvisioningService())->latestEvent($id);
        return $this->json(['status' => 'success', 'data' => [
            'provision_status' => $t->provision_status ?? 'none',
            'workspace_url' => $t->workspace_url ?? null,
            'provision_error' => $t->provision_error ?? null,
            'event' => $event ? [
                'status' => $event->status,            // pending | sending | sent | failed
                'event_type' => $event->event_type,
                'attempts' => (int)$event->attempts,
                'last_error' => $event->last_error,
                'sent_at' => $event->sent_at,
            ] : null,
        ]]);
    }

    public function listWebhooks() {
        $this->checkAuth();
        $tenantId = isset($_GET['tenant_id']) ? (int)$_GET['tenant_id'] : null;
        return $this->json(['status' => 'success', 'data' => (new ProvisioningService())->events($tenantId)]);
    }

    public function retryWebhook() {
        $this->checkAuth();
        set_time_limit(400);
        $ok = (new ProvisioningService())->retry((int)(($this->getPostData() ?: [])['id'] ?? 0));
        return $this->json(['status' => 'success', 'data' => ['delivered' => $ok]]);
    }

    public function runWebhooks() {
        $this->checkAuth();
        set_time_limit(600);
        [$sent, $failed] = (new ProvisioningService())->deliverDue();
        return $this->json(['status' => 'success', 'data' => ['sent' => $sent, 'not_sent' => $failed]]);
    }
}
