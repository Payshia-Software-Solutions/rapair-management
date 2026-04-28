<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Model.php';
require_once 'server/app/models/Reservation.php';

$resModel = new Reservation();
$id = 3; // or any valid id
$res = $resModel->getById($id);
print_r($res);
