<?php
define('DB_HOST', 'localhost');
define('DB_NAME', 'repair_management_db');
define('DB_USER', 'root');
define('DB_PASS', '');
require_once 'c:/xampp/htdocs/rapair-management/server/app/core/Database.php';
require_once 'c:/xampp/htdocs/rapair-management/server/app/core/Controller.php';
require_once 'c:/xampp/htdocs/rapair-management/server/app/controllers/IntelligenceController.php';

class TestController extends IntelligenceController {
    public function success($data = [], $message = 'Success') {
        echo "SUCCESS: " . json_encode($data) . "\n";
    }
    public function error($message = 'Internal S...', $status = 500) {
        echo "ERROR ($status): $message\n";
    }
}

$c = new TestController();
$_SERVER['HTTP_X_AI_SECRET'] = 'super-secret-ai-token-123';
echo "Testing Schema:\n";
$c->schema();
echo "\nTesting Query:\n";
$_POST['sql'] = "SELECT COUNT(*) as total FROM invoices"; // Simulate post if needed
$c->query();
