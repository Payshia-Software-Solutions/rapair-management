<?php
/**
 * Default Pages Controller
 */

class PagesController extends Controller {
    public function index() {
        $this->success([
            'version' => '1.0.0',
            'api_name' => SITENAME,
            'status' => 'Operational'
        ], 'Welcome to the Repair Management API');
    }

    public function status() {
        // Test Database connection
        try {
            $db = new Database();
            $db_status = 'Connected';
        } catch (Exception $e) {
            $db_status = 'Disconnected: ' . $e->getMessage();
        }

        $this->success([
            'environment' => 'Development',
            'database' => $db_status,
            'php_version' => phpversion()
        ]);
    }
}
