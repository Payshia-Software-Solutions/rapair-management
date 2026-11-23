<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Core\Database;
use App\Models\TenantModel;
use App\Models\PackageModel;

class SaaSController extends Controller {
    
    // --- PUBLIC ENDPOINTS ---

    public function getTenantConfig() {
        // Tenant details (incl. license key) are admin-only. Tenant servers use /api/saas/license/check.
        $this->checkAuth();
        // Use regex param if available, otherwise get parameter
        $slug = $this->route_params['slug'] ?? ($_GET['slug'] ?? '');
        $model = new TenantModel();
        $config = $model->getBySlug($slug);

        if ($config) {
            $config->modules = json_decode($config->modules);
            return $this->json(['status' => 'success', 'data' => $config]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Tenant not found or inactive'], 404);
        }
    }

    public function getStats() {
        $this->checkAuth();
        $model = new TenantModel();
        return $this->json(['status' => 'success', 'data' => $model->getStats()]);
    }

    public function getLicenseDetails() {
        $key = $_GET['key'] ?? '';
        if (empty($key)) {
            return $this->json(['status' => 'error', 'message' => 'License key or API key required'], 400);
        }

        $model = new TenantModel();
        // Try as API key first (NX-...)
        $details = $model->getByApiKey($key);
        
        // If not found, try as License Key (RM-...)
        if (!$details) {
            $details = $model->getByLicenseKey($key);
        }

        if ($details) {
            if (isset($details->modules) && is_string($details->modules)) {
                $details->modules = json_decode($details->modules);
            }
            return $this->json(['status' => 'success', 'data' => $details]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Invalid or inactive license key'], 404);
        }
    }

    // POST /api/saas/usage-report?key=  The workspace reports its active users and branches.
    public function usageReport() {
        $key = $_GET['key'] ?? '';
        $data = $this->getPostData() ?: [];
        if ($key === '' || !isset($data['users'], $data['locations'])) {
            return $this->json(['status' => 'error', 'message' => 'key, users and locations are required'], 400);
        }
        $ok = (new TenantModel())->saveUsageByApiKey($key, (int)$data['users'], (int)$data['locations']);
        return $this->json(['status' => $ok ? 'success' : 'error'], $ok ? 200 : 404);
    }

    // --- ADMIN PROTECTED ENDPOINTS ---

    private function checkAuth() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }

    /**
     * Tells the tenant's product about the change (shared-deployment tenants only; nothing for
     * dedicated or billing-only ones). Never fails the admin action: problems are logged and the
     * event stays in the outbox for retry.
     */
    private function notifyProduct($oldData, $tenantId) {
        try { (new \App\Services\ProvisioningService())->onTenantChanged($oldData, (int)$tenantId); }
        catch (\Throwable $e) { error_log('Provisioning (tenant change): ' . $e->getMessage()); }
    }

    public function listTenants() {
        $this->checkAuth();
        $model = new TenantModel();
        return $this->json(['status' => 'success', 'data' => $model->getAll()]);
    }

    public function getTenant() {
        $this->checkAuth();
        $id = $this->route_params['id'] ?? ($_GET['id'] ?? null);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);
        
        $model = new TenantModel();
        $tenant = $model->getByIdWithPackage($id);
        
        if ($tenant) {
            return $this->json(['status' => 'success', 'data' => $tenant]);
        }
        
        // Debug: check if it exists at all
        error_log("Tenant not found for ID: " . $id);
        return $this->json(['status' => 'error', 'message' => 'Tenant not found for ID: ' . $id], 404);
    }

    /** Email list (comma separated). Accepts a plain string or a JSON-encoded string from older forms. */
    private function normalizeEmailList($value): ?string {
        if (is_array($value)) {
            $value = implode(',', $value);
        } elseif (is_string($value) && strlen($value) > 1 && ($value[0] === '"' || $value[0] === '[')) {
            // Legacy values were stored JSON-encoded: "a@x.com" or ["a@x.com","b@x.com"].
            $decoded = json_decode($value, true);
            if (is_string($decoded)) $value = $decoded;
            elseif (is_array($decoded)) $value = implode(',', array_filter(array_map('trim', $decoded)));
        }
        $value = trim((string)($value ?? ''));
        return $value === '' ? null : $value;
    }

    private function emailListProblem(?string $list): ?string {
        if ($list === null) return null;
        foreach (array_map('trim', explode(',', $list)) as $addr) {
            if (!filter_var($addr, FILTER_VALIDATE_EMAIL)) return "Invalid CC email address: $addr";
        }
        return null;
    }

    /**
     * Validates and normalizes tenant input for register and update.
     * Returns an error message, or null when $d is ready to save.
     */
    private function validateTenant(array &$d, ?int $excludeId = null): ?string {
        $d['name'] = trim((string)($d['name'] ?? ''));
        $d['slug'] = strtolower(trim((string)($d['slug'] ?? '')));
        $d['admin_email'] = strtolower(trim((string)($d['admin_email'] ?? '')));
        $d['billing_cc_email'] = $this->normalizeEmailList($d['billing_cc_email'] ?? null);

        if ($d['name'] === '' || mb_strlen($d['name']) > 190) return 'Company name is required (max 190 characters).';
        if (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/', $d['slug'])) {
            return 'Slug must be 3-63 characters: lowercase letters, digits and hyphens, not starting or ending with a hyphen.';
        }
        if (in_array($d['slug'], ['www', 'api', 'admin', 'app', 'mail', 'static', 'login', 'nexus'], true)) return 'That slug is reserved.';
        if ($d['admin_email'] === '' || !filter_var($d['admin_email'], FILTER_VALIDATE_EMAIL)) return 'A valid administrative email is required.';
        if ($problem = $this->emailListProblem($d['billing_cc_email'])) return $problem;

        $cycle = strtolower((string)($d['billing_cycle'] ?? 'monthly'));
        if (!in_array($cycle, ['monthly', 'yearly'], true)) return 'Billing cycle must be monthly or yearly.';
        $d['billing_cycle'] = $cycle;

        $db = new Database();
        $db->query("SELECT currency_code FROM saas_exchange_rates");
        $currencies = array_map(fn($r) => strtoupper($r->currency_code), $db->resultSet());
        $currencies[] = 'USD';
        $cur = strtoupper((string)($d['currency'] ?? 'USD'));
        if (!in_array($cur, $currencies, true)) return "Unsupported billing currency: $cur.";
        $d['currency'] = $cur;

        $pkg = (new PackageModel())->getById((int)($d['package_id'] ?? 0));
        if (!$pkg) return 'Choose a valid subscription package.';

        $tm = new TenantModel();
        if ($tm->slugTaken($d['slug'], $excludeId ?? 0)) return 'That workspace name (slug) is already used by another tenant.';
        $tm->releaseSlugFromDeleted($d['slug']); // an old deleted tenant may still hold it

        return null;
    }

    public function registerTenant() {
        $this->checkAuth();
        $data = $this->getPostData() ?: [];

        // A new tenant starts on a trial, or goes straight to Active for a paid registration.
        $status = $data['status'] ?? 'Trial';
        if (!in_array($status, ['Trial', 'Active'], true)) {
            return $this->json(['status' => 'error', 'message' => 'New tenants can only start as Trial or Active.'], 400);
        }
        $data['status'] = $status;

        if ($error = $this->validateTenant($data)) {
            return $this->json(['status' => 'error', 'message' => $error], 400);
        }

        if ($status === 'Trial') {
            $days = (int)($data['trial_days'] ?? 14);
            if ($days < 1 || $days > 90) return $this->json(['status' => 'error', 'message' => 'Trial length must be 1-90 days.'], 400);
            $data['trial_expiry'] = date('Y-m-d', strtotime("+$days days"));
        } else {
            $data['trial_expiry'] = date('Y-m-d', strtotime($data['billing_cycle'] === 'yearly' ? '+1 year' : '+1 month'));
        }

        $model = new TenantModel();
        $license = $model->create($data);
        if ($license) {
            return $this->json(['status' => 'success', 'message' => 'Tenant registered', 'license_key' => $license]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Registration failed'], 500);
        }
    }

    public function updateTenant() {
        $this->checkAuth();
        $data = $this->getPostData() ?: [];
        $model = new TenantModel();

        $existing = $model->getByIdWithPackage($data['id'] ?? 0);
        if (!$existing) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);

        // Keep stored keys and status when the request does not send them (a missing key must never null them).
        $data['license_key'] = $data['license_key'] ?? $existing->license_key;
        $data['api_key'] = $data['api_key'] ?? $existing->api_key;
        $data['status'] = $data['status'] ?? $existing->status;
        if (!in_array($data['status'], ['Active', 'Trial', 'Suspended', 'Expired'], true)) {
            return $this->json(['status' => 'error', 'message' => 'Unknown account status.'], 400);
        }
        if ($error = $this->validateTenant($data, (int)$data['id'])) {
            return $this->json(['status' => 'error', 'message' => $error], 400);
        }
        $model = new TenantModel();
        
        // Fetch current state for change detection
        $oldData = $model->getByIdWithPackage($data['id']);
        if (!$oldData) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);

        if ($model->update($data)) {
            // Change Detection Logic
            $changes = [];
            $fieldsToTrack = [
                'status' => 'Account Status',
                'package_id' => 'Subscription Plan',
                'currency' => 'Billing Currency',
                'billing_cycle' => 'Billing Cycle',
                'trial_expiry' => 'Trial Expiry Date'
            ];

            foreach ($fieldsToTrack as $key => $label) {
                $oldVal = (string)$oldData->$key;
                $newVal = (string)($data[$key] ?? $oldVal);

                if ($oldVal !== $newVal) {
                    // For package_id, fetch names
                    if ($key === 'package_id') {
                        $pkgModel = new PackageModel();
                        $oldPkg = $pkgModel->getById($oldVal);
                        $newPkg = $pkgModel->getById($newVal);
                        $oldVal = $oldPkg ? $oldPkg->name : $oldVal;
                        $newVal = $newPkg ? $newPkg->name : $newVal;
                    }
                    $changes[$label] = ['old' => $oldVal, 'new' => $newVal];
                }
            }

            if (!empty($changes)) {
                $sent = \App\Core\Mailer::sendTenantUpdateEmail($oldData->admin_email, $oldData->name, $changes);
                $model->logEmail(null, 'Account Update', $oldData->admin_email, null, $sent ? 'Sent' : 'Failed');
            }

            $this->notifyProduct($oldData, $data['id']);
            return $this->json(['status' => 'success', 'message' => 'Tenant updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function updateTenantStatus() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new TenantModel();
        
        $oldData = $model->getByIdWithPackage($data['id']);
        if (!$oldData) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);

        if ($model->updateStatus($data['id'], $data['status'])) {
            if ($oldData->status !== $data['status']) {
                $changes = [
                    'Account Status' => ['old' => $oldData->status, 'new' => $data['status']]
                ];
                $sent = \App\Core\Mailer::sendTenantUpdateEmail($oldData->admin_email, $oldData->name, $changes);
                $model->logEmail(null, 'Account Update', $oldData->admin_email, null, $sent ? 'Sent' : 'Failed');
            }
            $this->notifyProduct($oldData, $data['id']);
            return $this->json(['status' => 'success', 'message' => 'Status updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function deleteTenant() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new TenantModel();
        $oldData = $model->getByIdWithPackage($data['id']);
        if ($model->delete($data['id'])) {
            // Tells the ERP to delete the workspace and its database (sent before the name is freed below)
            if ($oldData) $this->notifyProduct($oldData, $data['id']);
            $this->freeDeletedTenant((int)$data['id']);
            return $this->json(['status' => 'success', 'message' => 'Tenant deleted']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Deletion failed'], 500);
        }
    }

    /**
     * A deleted tenant must not block a fresh start: removes its client logins (so the email can sign
     * up again) and renames its workspace name (so the same name can be used again).
     * The tenant row stays, marked Deleted, for invoice and payment history.
     */
    private function freeDeletedTenant(int $id) {
        try {
            $db = new \App\Core\Database();
            $db->query("DELETE FROM portal_admins WHERE tenant_id = :id AND role = 'client'");
            $db->bind(':id', $id);
            $db->execute();
            $db->query("UPDATE saas_tenants SET slug = CONCAT(slug, '-deleted-', id)
                        WHERE id = :id AND status = 'Deleted' AND slug NOT LIKE '%-deleted-%'");
            $db->bind(':id', $id);
            $db->execute();
        } catch (\Throwable $e) {
            error_log('Free deleted tenant ' . $id . ': ' . $e->getMessage());
        }
    }

    public function suspendTenant() {
        $this->checkAuth();
        $data = $this->getPostData();
        $tenantId = (int)($data['id'] ?? 0);
        $reason = trim((string)($data['reason'] ?? '')) ?: 'Account suspended by administrator';

        $model = new TenantModel();
        $oldData = $tenantId ? $model->getByIdWithPackage($tenantId) : null;
        if (!$oldData) return $this->json(['status' => 'error', 'message' => 'Tenant not found'], 404);
        if ($oldData->status === 'Suspended') return $this->json(['status' => 'error', 'message' => 'Workspace is already suspended'], 400);

        if (!$model->updateStatus($tenantId, 'Suspended')) {
            return $this->json(['status' => 'error', 'message' => 'Suspension failed'], 500);
        }
        \App\Core\Mailer::sendSuspensionEmail($oldData->admin_email, $oldData->name, $reason);
        $this->notifyProduct($oldData, $tenantId);

        return $this->json(['status' => 'success', 'message' => 'Workspace suspended. The customer has been notified.']);
    }

    public function listPackages() {
        $model = new PackageModel();
        $db = new \App\Core\Database();
        $db->query("SELECT setting_value FROM saas_settings WHERE setting_key = 'annual_discount_percentage'");
        $row = $db->single();
        $discount = $row ? floatval($row->setting_value) : 20.0;

        return $this->json([
            'status' => 'success', 
            'data' => $model->getAll(),
            'annual_discount_percentage' => $discount
        ]);
    }

    public function getPackage() {
        $this->checkAuth();
        $id = $this->route_params['id'] ?? ($_GET['id'] ?? null);
        if (!$id) return $this->json(['status' => 'error', 'message' => 'ID required'], 400);
        
        $model = new PackageModel();
        $package = $model->getById($id);
        
        if ($package) {
            $package->modules = json_decode($package->modules);
            return $this->json(['status' => 'success', 'data' => $package]);
        }
        return $this->json(['status' => 'error', 'message' => 'Package not found'], 404);
    }

    public function createPackage() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new PackageModel();
        if ($model->create($data)) {
            return $this->json(['status' => 'success', 'message' => 'Package created']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Creation failed'], 500);
        }
    }

    public function updatePackage() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new PackageModel();
        if ($model->update($data)) {
            // Shared workspaces on this package get the new module list
            try { (new \App\Services\ProvisioningService())->onPackageChanged((int)$data['id']); }
            catch (\Throwable $e) { error_log('Provisioning (package change): ' . $e->getMessage()); }
            return $this->json(['status' => 'success', 'message' => 'Package updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function deletePackage() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new PackageModel();
        if ($model->delete($data['id'])) {
            return $this->json(['status' => 'success', 'message' => 'Package deleted']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Deletion failed'], 500);
        }
    }

    // POST /api/client/profile  A client edits their own business and contact details (email and workspace name are not editable here).
    public function updateMyProfile() {
        if (!isset($_SESSION['admin_id'], $_SESSION['tenant_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }
        $data = $this->getPostData() ?: [];
        $model = new \App\Models\TenantModel();
        $current = $model->getByIdWithPackage((int)$_SESSION['tenant_id']);
        if (!$current) {
            return $this->json(['status' => 'error', 'message' => 'Account not found'], 404);
        }

        // Every field is optional; whatever is not sent keeps its current value.
        $pick = function ($key, $fallback) use ($data) {
            return array_key_exists($key, $data) ? trim((string)$data[$key]) : (string)$fallback;
        };
        $type = ($data['customer_type'] ?? $current->customer_type) === 'solo' ? 'solo' : 'company';
        $name = $pick('name', $current->name);
        $contact = $pick('contact_person_name', $current->contact_person_name);
        $identity = $pick('nic_br_number', $current->nic_br_number);
        $category = $pick('business_type', $current->business_type);
        $phone = $pick('contact_number', $current->contact_number);
        $address = $pick('address', $current->address);

        $error = null;
        if ($name === '' || mb_strlen($name) > 100) {
            $error = $type === 'solo' ? 'Enter your name.' : 'Enter the company name.';
        } elseif ($contact === '' || mb_strlen($contact) > 100) {
            $error = 'Enter the contact person name.';
        } elseif ($type === 'solo' && !preg_match('/^(\d{9}[VvXx]|\d{12})$/', $identity)) {
            $error = 'Enter a valid NIC number (9 digits and V, or 12 digits).';
        } elseif ($type === 'company' && strlen($identity) < 5) {
            $error = 'Enter a valid BR number.';
        } elseif (mb_strlen($category) > 100) {
            $error = 'Business category is too long.';
        } elseif ($phone !== '' && !preg_match('/^[0-9+()\-\s]{7,30}$/', $phone)) {
            $error = 'Enter a valid phone number.';
        } elseif (mb_strlen($address) > 500) {
            $error = 'Address is too long (500 characters max).';
        }
        if ($error) return $this->json(['status' => 'error', 'message' => $error], 400);

        $db = new Database();
        $db->query("UPDATE saas_tenants SET name = :name, customer_type = :type, nic_br_number = :nic, contact_person_name = :contact, business_type = :cat, contact_number = :phone, address = :address WHERE id = :id");
        $db->bind(':name', $name);
        $db->bind(':type', $type);
        $db->bind(':nic', $identity);
        $db->bind(':contact', $contact);
        $db->bind(':cat', $category);
        $db->bind(':phone', $phone !== '' ? $phone : null);
        $db->bind(':address', $address);
        $db->bind(':id', (int)$_SESSION['tenant_id']);
        $db->execute();

        return $this->json(['status' => 'success', 'message' => 'Details updated.']);
    }

    public function getMySubscription() {
        if (!isset($_SESSION['tenant_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }

        $model = new \App\Models\TenantModel();
        $subscription = $model->getByIdWithPackage($_SESSION['tenant_id']);
        
        if ($subscription) {
            // A workspace that is still pending gets another delivery attempt (no cron needed).
            if (($subscription->provision_status ?? '') === 'pending') {
                try {
                    (new \App\Services\ProvisioningService())->deliverDue(5);
                    $subscription = $model->getByIdWithPackage($_SESSION['tenant_id']);
                } catch (\Throwable $e) {
                    error_log('Provisioning retry on subscription load: ' . $e->getMessage());
                }
            }

            $subscription->package_modules = json_decode($subscription->package_modules);
            // Same cut-off as the ERP: a trial counts as ended the day after its end date.
            $endsAt = $subscription->trial_expiry ? strtotime($subscription->trial_expiry) + 86400 : null;
            $startedAt = $subscription->created_at ? strtotime(substr($subscription->created_at, 0, 10)) : null;
            $subscription->trial_days_left = ($subscription->status === 'Trial' && $endsAt)
                ? max(0, (int)ceil(($endsAt - time()) / 86400)) : null;
            $subscription->trial_total_days = ($endsAt && $startedAt)
                ? max(1, (int)round((strtotime($subscription->trial_expiry) - $startedAt) / 86400)) : 14;
            $subscription->next_billing_date = $subscription->trial_expiry ?: null;
            // 999+ or empty means unlimited. Usage is what the workspace last reported.
            $cap = function ($v) { $n = (int)$v; return ($n < 1 || $n >= 999) ? null : $n; };
            $subscription->limits = [
                'max_users' => $cap($subscription->max_users ?? null),
                'max_locations' => $cap($subscription->max_locations ?? null),
                'users' => $subscription->usage_users !== null ? (int)$subscription->usage_users : null,
                'locations' => $subscription->usage_locations !== null ? (int)$subscription->usage_locations : null,
                'updated_at' => $subscription->usage_updated_at,
            ];
            return $this->json(['status' => 'success', 'data' => $subscription]);
        }
        return $this->json(['status' => 'error', 'message' => 'Subscription details not found'], 404);
    }
}
