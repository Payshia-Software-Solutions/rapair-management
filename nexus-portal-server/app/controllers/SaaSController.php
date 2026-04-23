<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\TenantModel;
use App\Models\PackageModel;

class SaaSController extends Controller {
    
    // --- PUBLIC ENDPOINTS ---

    public function getTenantConfig() {
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
        $model = new TenantModel();
        return $this->json(['status' => 'success', 'data' => $model->getStats()]);
    }

    public function getLicenseDetails() {
        $key = $_GET['key'] ?? '';
        if (empty($key)) {
            return $this->json(['status' => 'error', 'message' => 'License key required'], 400);
        }

        $model = new TenantModel();
        $details = $model->getByApiKey($key);

        if ($details) {
            $details->modules = json_decode($details->modules);
            // Hide sensitive DB internal IDs if necessary, but user asked for "full details"
            return $this->json(['status' => 'success', 'data' => $details]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Invalid or inactive license key'], 404);
        }
    }

    // --- ADMIN PROTECTED ENDPOINTS ---

    private function checkAuth() {
        if (!isset($_SESSION['admin_id'])) {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
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

    public function registerTenant() {
        $this->checkAuth();
        $data = $this->getPostData();
        if (empty($data['name']) || empty($data['slug'])) {
            return $this->json(['status' => 'error', 'message' => 'Name and Slug required'], 400);
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
        $data = $this->getPostData();
        $model = new TenantModel();
        if ($model->update($data)) {
            return $this->json(['status' => 'success', 'message' => 'Tenant updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function updateTenantStatus() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new TenantModel();
        if ($model->updateStatus($data['id'], $data['status'])) {
            return $this->json(['status' => 'success', 'message' => 'Status updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function deleteTenant() {
        $this->checkAuth();
        $data = $this->getPostData();
        $model = new TenantModel();
        if ($model->delete($data['id'])) {
            return $this->json(['status' => 'success', 'message' => 'Tenant deleted']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Deletion failed'], 500);
        }
    }

    public function listPackages() {
        $model = new PackageModel();
        return $this->json(['status' => 'success', 'data' => $model->getAll()]);
    }

    public function getPackage() {
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

    public function getMySubscription() {
        if (!isset($_SESSION['tenant_id'])) {
            return $this->json(['status' => 'error', 'message' => 'Not a tenant account'], 403);
        }

        $model = new \App\Models\TenantModel();
        $subscription = $model->getByIdWithPackage($_SESSION['tenant_id']);
        
        if ($subscription) {
            $subscription->package_modules = json_decode($subscription->package_modules);
            return $this->json(['status' => 'success', 'data' => $subscription]);
        }
        return $this->json(['status' => 'error', 'message' => 'Subscription details not found'], 404);
    }
}
