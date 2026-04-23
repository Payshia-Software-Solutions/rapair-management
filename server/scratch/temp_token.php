<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/helpers/JwtHelper.php';

$payload = [
    'sub' => 1,
    'role' => 'admin',
    'iss' => JWT_ISSUER,
    'iat' => time(),
    'exp' => time() + 3600
];

echo JwtHelper::encode($payload, JWT_SECRET);
