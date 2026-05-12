<?php
$file1 = '../app/controllers/ProductionbomController.php';
$file2 = '../app/controllers/ProductionBOMController.php';

echo "Checking from " . getcwd() . "\n";
echo "File 1 ($file1): " . (file_exists($file1) ? 'Exists' : 'Not Found') . "\n";
echo "File 2 ($file2): " . (file_exists($file2) ? 'Exists' : 'Not Found') . "\n";

$url = 'productionbom';
$controllerName = ucwords($url) . 'Controller';
echo "Controller Name for '$url': $controllerName\n";
echo "File for '$url' exists: " . (file_exists('../app/controllers/' . $controllerName . '.php') ? 'Yes' : 'No') . "\n";
