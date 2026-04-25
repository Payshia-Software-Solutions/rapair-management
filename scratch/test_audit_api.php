<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Controller.php';
require_once 'server/app/controllers/ReportController.php';

// Mocking session/auth for testing
class MockReportController extends ReportController {
    public function requireAuth() {
        return ['role' => 'Admin'];
    }
    public function success($data = [], $message = 'Success') {
        echo json_encode($data);
    }
    public function error($message = 'Internal Server Error', $status = 500) {
        echo "ERROR: $message";
    }
}

$c = new MockReportController();
$c->database_audit();
