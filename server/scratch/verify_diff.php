<?php
require_once dirname(__FILE__) . '/../config/config.php';
require_once dirname(__FILE__) . '/../app/core/Database.php';
require_once dirname(__FILE__) . '/../app/core/SchemaHelper.php';

$db = new Database();
$helper = new SchemaHelper($db);
$diff = $helper->getDiff();

echo json_encode($diff, JSON_PRETTY_PRINT);
