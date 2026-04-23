<?php
/**
 * Nexus Portal API Entry Point
 */
session_start([
    'cookie_lifetime' => 86400,
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax'
]);

// Global CORS Handling
$origin = $_SERVER['HTTP_ORIGIN'] ?? 'http://localhost:3000';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Autoloader (Simple PSR-4)
require_once __DIR__ . '/../vendor/autoload.php';
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/../app/';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    if (file_exists($file)) require $file;
});

use App\Core\Router;

$router = new Router();

// Routes
$router->add('api/request', ['controller' => 'PortalController', 'action' => 'submitRequest'], 'POST');
$router->add('api/auth/register', ['controller' => 'AuthController', 'action' => 'register'], 'POST');
$router->add('api/auth/verify', ['controller' => 'AuthController', 'action' => 'verify']);
$router->add('api/auth/login', ['controller' => 'AuthController', 'action' => 'login'], 'POST');
$router->add('api/auth/logout', ['controller' => 'AuthController', 'action' => 'logout']);
$router->add('api/auth/check', ['controller' => 'AuthController', 'action' => 'check']);

// SaaS Public Routes
$router->add('api/saas/config/([a-z0-9-]+)', ['controller' => 'SaaSController', 'action' => 'getTenantConfig', 'slug' => '$1']);
$router->add('api/saas/stats', ['controller' => 'SaaSController', 'action' => 'getStats']);
$router->add('api/saas/packages', ['controller' => 'SaaSController', 'action' => 'listPackages']);
$router->add('api/saas/license/check', ['controller' => 'SaaSController', 'action' => 'getLicenseDetails']);

// Admin Protected Routes (Logic in controller handles auth check)
$router->add('api/admin/requests', ['controller' => 'AdminController', 'action' => 'listRequests']);
$router->add('api/admin/requests/update', ['controller' => 'AdminController', 'action' => 'updateStatus'], 'POST');
$router->add('api/admin/users', ['controller' => 'AdminController', 'action' => 'listUsers']);
$router->add('api/admin/users/create', ['controller' => 'AdminController', 'action' => 'createUser'], 'POST');

// SaaS Admin Routes
$router->add('api/admin/tenants', ['controller' => 'SaaSController', 'action' => 'listTenants']);
$router->add('api/admin/tenants/register', ['controller' => 'SaaSController', 'action' => 'registerTenant'], 'POST');
$router->add('api/admin/tenants/update', ['controller' => 'SaaSController', 'action' => 'updateTenant'], 'POST');
$router->add('api/admin/tenants/update-status', ['controller' => 'SaaSController', 'action' => 'updateTenantStatus'], 'POST');
$router->add('api/admin/tenants/delete', ['controller' => 'SaaSController', 'action' => 'deleteTenant'], 'POST');
$router->add('api/admin/tenants/{id}', ['controller' => 'SaaSController', 'action' => 'getTenant']);

$router->add('api/admin/packages', ['controller' => 'SaaSController', 'action' => 'listPackages']);
$router->add('api/admin/packages/{id}', ['controller' => 'SaaSController', 'action' => 'getPackage']);
$router->add('api/admin/packages/create', ['controller' => 'SaaSController', 'action' => 'createPackage'], 'POST');
$router->add('api/admin/packages/update', ['controller' => 'SaaSController', 'action' => 'updatePackage'], 'POST');
$router->add('api/admin/packages/delete', ['controller' => 'SaaSController', 'action' => 'deletePackage'], 'POST');

$router->add('api/client/subscription', ['controller' => 'SaaSController', 'action' => 'getMySubscription']);

// Billing Routes
$router->add('api/admin/billing/run-cycle', ['controller' => 'BillingController', 'action' => 'runBillingCycle'], 'POST');
$router->add('api/admin/billing/list', ['controller' => 'BillingController', 'action' => 'listAll']);
$router->add('api/admin/billing/download', ['controller' => 'BillingController', 'action' => 'download']);
$router->add('api/admin/billing/resend', ['controller' => 'BillingController', 'action' => 'resend']);
$router->add('api/admin/billing/update', ['controller' => 'BillingController', 'action' => 'update'], 'POST');
$router->add('api/client/billing/history', ['controller' => 'BillingController', 'action' => 'getMyHistory']);

// Match and Dispatch
$url = $_GET['url'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

$router->dispatch($url, $method);
