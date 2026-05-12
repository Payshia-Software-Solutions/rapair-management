<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';
require_once 'app/core/Controller.php';
require_once 'app/controllers/PosController.php';

$_GET['location_id'] = 1;

class MockPosController extends PosController {
    public function requirePermission($p) { return ['sub' => 1, 'role' => 'admin']; }
    public function json($data, $status = 200) { echo json_encode($data, JSON_PRETTY_PRINT); exit; }
}

$ctrl = new MockPosController();
$ctrl->held_orders();
