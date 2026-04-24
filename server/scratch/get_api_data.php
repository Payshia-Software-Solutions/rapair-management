<?php
$json = file_get_contents('http://localhost/rapair-management/server/public/api/onlineorder/index');
$data = json_decode($json, true);
echo json_encode($data, JSON_PRETTY_PRINT);
