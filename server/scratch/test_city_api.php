<?php
// Mock a request to CityController::index()
require_once __DIR__ . '/../app/core/Database.php';
require_once __DIR__ . '/../app/core/Controller.php';
require_once __DIR__ . '/../app/controllers/CityController.php';

$_GET['district_id'] = 1; // Colombo

$ctrl = new CityController();
ob_start();
$ctrl->index();
$output = ob_get_clean();

echo "Response for District 1 (Colombo):\n";
echo $output . "\n";
