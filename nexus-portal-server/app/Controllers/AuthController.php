<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\AdminModel;

class AuthController extends Controller {
    public function login() {
        $data = $this->getPostData();
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        $model = new AdminModel();
        $user = $model->findByUsername($username);

        if ($user && password_verify($password, $user->password)) {
            if ($user->email_verified == 0) {
                return $this->json(['status' => 'error', 'message' => 'Email verification required. Please check your inbox.'], 403);
            }
            $_SESSION['admin_id'] = $user->id;
            $_SESSION['admin_user'] = $user->username;
            $_SESSION['admin_role'] = $user->role;
            $_SESSION['tenant_id'] = $user->tenant_id;
            return $this->json(['status' => 'success', 'user' => $user->username, 'role' => $user->role, 'token' => session_id()]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Invalid credentials'], 401);
        }
    }

    public function register() {
        $data = $this->getPostData();
        
        // Basic validation
        if (empty($data['company_name']) || empty($data['email']) || empty($data['password'])) {
            return $this->json(['status' => 'error', 'message' => 'Missing required registration fields'], 400);
        }

        // 1. Initialize Models & DB
        $tenantModel = new \App\Models\TenantModel();
        $adminModel = new \App\Models\AdminModel();
        $db = new \App\Core\Database();

        // 2. Pre-Validation Check
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9-]+/', '-', $data['company_name'])));
        
        // Check if email exists
        if ($adminModel->findByUsername($data['email'])) {
            return $this->json(['status' => 'error', 'message' => 'Email address is already registered.'], 409);
        }

        // Check if slug exists
        $db->query("SELECT id FROM saas_tenants WHERE slug = :slug");
        $db->bind(':slug', $slug);
        if ($db->single()) {
            return $this->json(['status' => 'error', 'message' => 'Company name is already taken. Please try another.'], 409);
        }

        // 3. Prepare Tenant Data
        $tenantData = [
            'name' => $data['company_name'],
            'address' => $data['address'] ?? '',
            'business_type' => $data['business_type'] ?? '',
            'admin_email' => $data['email'],
            'slug' => $slug,
            'package_id' => $data['package_id'] ?? 1,
            'billing_cycle' => $data['billing_cycle'] ?? 'monthly',
            'currency' => $data['currency'] ?? 'USD'
        ];

        // 4. Create Tenant & Admin using a Transaction
        try {
            $db->beginTransaction();

            $tenantResult = $tenantModel->create($tenantData);
            if (!$tenantResult) {
                $db->rollBack();
                return $this->json(['status' => 'error', 'message' => 'Failed to create business profile'], 500);
            }

            // Create Portal Admin linked to Tenant
            $token = bin2hex(random_bytes(32));
            $adminData = [
                'tenant_id' => $tenantResult['id'],
                'username' => $data['email'],
                'password' => $data['password'],
                'full_name' => $data['contact_person'] ?? $data['company_name'],
                'verification_token' => $token,
                'role' => 'client'
            ];

            if ($adminModel->create($adminData)) {
                $db->commit();
                
                // Send Verification Email
                \App\Core\Mailer::sendVerificationEmail($data['email'], $adminData['full_name'], $token);

                return $this->json([
                    'status' => 'success', 
                    'message' => 'Registration successful! Please check your email to verify your account before logging in.',
                    'license_key' => $tenantResult['license']
                ]);
            } else {
                $db->rollBack();
                return $this->json(['status' => 'error', 'message' => 'Business profile created, but user account failed'], 500);
            }
        } catch (\PDOException $e) {
            $db->rollBack();
            return $this->json(['status' => 'error', 'message' => 'A database error occurred during registration.'], 500);
        }
    }

    public function verify() {
        $token = $_GET['token'] ?? '';
        if (empty($token)) {
            return $this->json(['status' => 'error', 'message' => 'Invalid or missing verification token'], 400);
        }

        $model = new \App\Models\AdminModel();
        $user = $model->findByToken($token);

        if ($user) {
            if ($model->verifyByToken($token)) {
                return $this->json(['status' => 'success', 'message' => 'Your email has been verified! You can now log in.']);
            }
            return $this->json(['status' => 'error', 'message' => 'Verification failed on server side'], 500);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Token has expired or is invalid'], 404);
        }
    }

    public function logout() {
        session_destroy();
        return $this->json(['status' => 'success', 'message' => 'Logged out']);
    }

    public function check() {
        if (isset($_SESSION['admin_id'])) {
            return $this->json([
                'status' => 'success', 
                'user' => $_SESSION['admin_user'],
                'role' => $_SESSION['admin_role'] ?? 'client'
            ]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }
}
