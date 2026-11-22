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
            // New session id on login prevents session fixation. The id stays in the httpOnly cookie
            // and is never returned in the body.
            session_regenerate_id(true);
            $_SESSION['admin_id'] = $user->id;
            $_SESSION['admin_user'] = $user->username;
            $_SESSION['admin_role'] = $user->role;
            $_SESSION['tenant_id'] = $user->tenant_id;
            return $this->json(['status' => 'success', 'user' => $user->username, 'role' => $user->role]);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Invalid credentials'], 401);
        }
    }

    private const TRIAL_DAYS = 14;
    private const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'mail', 'static', 'login', 'nexus', 'order'];

    private function slugFor(string $name): string {
        return substr(trim(strtolower(preg_replace('/[^A-Za-z0-9]+/', '-', $name)), '-'), 0, 63);
    }

    // GET /api/auth/check-email?email=  Lets the signup form warn about a duplicate before the last step.
    public function checkEmail() {
        $email = strtolower(trim((string)($_GET['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->json(['status' => 'error', 'message' => 'Enter a valid email.'], 400);
        }
        $taken = (bool)(new AdminModel())->findByUsername($email);
        return $this->json(['status' => 'success', 'available' => !$taken]);
    }

    // POST /api/auth/resend-verification {email}  Same answer whether or not the address has an account.
    public function resendVerification() {
        $data = $this->getPostData() ?: [];
        $email = strtolower(trim((string)($data['email'] ?? '')));
        if (filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $user = (new AdminModel())->refreshToken($email);
            if ($user) {
                \App\Core\Mailer::sendVerificationEmail($email, $user->full_name ?: $email, $user->verification_token);
            }
        }
        return $this->json(['status' => 'success', 'message' => 'If that address has an unverified account, a new link is on its way.']);
    }

    // POST /api/auth/register  Public signup from the Order page. Creates the trial workspace record
    // and the client login (unverified). The ERP workspace is set up after the email is verified.
    public function register() {
        $data = $this->getPostData() ?: [];

        $type = ($data['customer_type'] ?? 'company') === 'solo' ? 'solo' : 'company';
        $email = strtolower(trim((string)($data['work_email'] ?? $data['email'] ?? '')));
        $contactPerson = trim((string)($data['contact_person'] ?? ''));
        $companyName = $type === 'solo' ? $contactPerson : trim((string)($data['company_name'] ?? ''));
        $identity = trim((string)($data['nic_br_number'] ?? ''));
        $password = (string)($data['password'] ?? '');
        $cycle = ($data['billing_cycle'] ?? 'monthly') === 'yearly' ? 'yearly' : 'monthly';
        $packageId = (int)($data['package_id'] ?? 0);
        $slug = $this->slugFor($companyName);

        $error = null;
        if ($contactPerson === '' || $companyName === '') {
            $error = 'Name is required.';
        } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $error = 'Enter a valid work email.';
        } elseif ($type === 'solo' && !preg_match('/^(\d{9}[VvXx]|\d{12})$/', $identity)) {
            $error = 'Enter a valid NIC number (9 digits and V, or 12 digits).';
        } elseif ($type === 'company' && strlen($identity) < 5) {
            $error = 'Enter a valid BR number.';
        } elseif (strlen($password) < 8) {
            $error = 'Password must be at least 8 characters.';
        } elseif ($password !== (string)($data['confirm_password'] ?? '')) {
            $error = 'Passwords do not match.';
        } elseif (empty($data['accept_terms'])) {
            $error = 'Please accept the terms to continue.';
        } elseif (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/', $slug) || in_array($slug, self::RESERVED_SLUGS, true)) {
            $error = 'The company name must contain letters or digits.';
        }
        if ($error) return $this->json(['status' => 'error', 'message' => $error], 400);

        $adminModel = new \App\Models\AdminModel();
        if ($adminModel->findByUsername($email)) {
            return $this->json(['status' => 'error', 'message' => 'This email is already registered. Sign in instead.'], 409);
        }

        $db = new \App\Core\Database();
        $db->query("SELECT id FROM saas_tenants WHERE slug = :slug AND status <> 'Deleted'");
        $db->bind(':slug', $slug);
        if ($db->single()) {
            return $this->json(['status' => 'error', 'message' => 'That company name is already taken.'], 409);
        }

        if (!(new \App\Models\PackageModel())->getById($packageId)) {
            return $this->json(['status' => 'error', 'message' => 'Choose a valid package.'], 400);
        }

        $tenantModel = new \App\Models\TenantModel();
        $tenant = $tenantModel->create([
            'name' => $companyName,
            'address' => trim((string)($data['address'] ?? '')),
            'business_type' => trim((string)($data['business_type'] ?? '')),
            'admin_email' => $email,
            'contact_number' => trim((string)($data['contact_number'] ?? '')) ?: null,
            'slug' => $slug,
            'package_id' => $packageId,
            'billing_cycle' => $cycle,
            'currency' => 'USD',
            'status' => 'Trial',
            'trial_expiry' => date('Y-m-d', strtotime('+' . self::TRIAL_DAYS . ' days')),
            'customer_type' => $type,
            'nic_br_number' => $identity,
            'contact_person_name' => $contactPerson,
        ]);
        if (!$tenant) {
            return $this->json(['status' => 'error', 'message' => 'Could not create the workspace. Try again.'], 500);
        }

        $db->query("UPDATE saas_tenants SET terms_accepted_at = NOW() WHERE id = :id");
        $db->bind(':id', $tenant['id']);
        $db->execute();

        $token = bin2hex(random_bytes(32));
        $created = $adminModel->create([
            'tenant_id' => $tenant['id'],
            'username' => $email,
            'password' => $password,
            'full_name' => $contactPerson,
            'verification_token' => $token,
            'role' => 'client',
        ]);
        if (!$created) {
            $tenantModel->delete($tenant['id']);
            return $this->json(['status' => 'error', 'message' => 'Could not create the account. Try again.'], 500);
        }

        \App\Core\Mailer::sendVerificationEmail($email, $contactPerson, $token);

        return $this->json([
            'status' => 'success',
            'message' => 'Account created. Check your email and click the verification link. Your trial workspace is set up after verification.',
        ]);
    }

    // GET /api/auth/verify?token=...  Confirms the email, then sets up the trial workspace on the ERP.
    public function verify() {
        $token = $_GET['token'] ?? '';
        if (empty($token)) {
            return $this->json(['status' => 'error', 'message' => 'Invalid or missing verification token'], 400);
        }

        $model = new \App\Models\AdminModel();
        $user = $model->findByToken($token);
        if (!$user) {
            return $this->json(['status' => 'error', 'message' => 'This link has expired or was already used.'], 404);
        }
        if (!$model->verifyByToken($token)) {
            return $this->json(['status' => 'error', 'message' => 'Verification failed on server side'], 500);
        }

        try {
            (new \App\Services\ProvisioningService())->provision((int)$user->tenant_id, true);
            $message = 'Email verified! Your 14-day trial workspace is being set up.';
        } catch (\Throwable $e) {
            error_log('Workspace setup after verification failed: ' . $e->getMessage());
            $message = 'Email verified. Your workspace setup is delayed; our team has been notified.';
        }
        return $this->json(['status' => 'success', 'message' => $message]);
    }
    public function logout() {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
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
