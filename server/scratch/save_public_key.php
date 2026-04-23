<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/core/Database.php';
require_once __DIR__ . '/../app/core/Model.php';
require_once __DIR__ . '/../app/helpers/SystemSchema.php';
require_once __DIR__ . '/../app/models/SystemSetting.php';

$s = new SystemSetting();
$s->update('PUBLIC_WEBSITE_API_KEY', 'd5c7854b02485ed0e601d9486838093cb7881dfb8d6920c1543bf8ad9ddc12fc');
echo 'API Key Saved: d5c7854b02485ed0e601d9486838093cb7881dfb8d6920c1543bf8ad9ddc12fc';
