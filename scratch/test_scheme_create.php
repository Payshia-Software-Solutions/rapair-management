<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Model.php';
require_once 'server/app/models/SalaryTemplate.php';

$model = new SalaryTemplate();
$name = "Test Scheme " . time();
echo "Attempting to create scheme: $name\n";

$res = $model->create($name);
if ($res) {
    echo "SUCCESS! Created ID: $res\n";
    // Clean up
    $model->delete($res);
    echo "Cleaned up.\n";
} else {
    echo "FAILED!\n";
    // Check for PDO errors if possible (usually Model/Database hides them)
}
