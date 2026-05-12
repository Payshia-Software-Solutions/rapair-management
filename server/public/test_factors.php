<?php
require_once 'server/app/config/config.php';
require_once 'server/app/libraries/Database.php';
require_once 'server/app/libraries/Model.php';
require_once 'server/app/models/LogisticsFactor.php';

$db = new Database();
$model = new LogisticsFactor();

$factors = $model->list(false);
echo json_encode($factors, JSON_PRETTY_PRINT);
