<?php
$start = microtime(true);
$password = "password123";
$hash = password_hash($password, PASSWORD_BCRYPT);
echo "Hash created in " . (microtime(true) - $start) . "s\n";

$start = microtime(true);
password_verify($password, $hash);
echo "Verify 1 in " . (microtime(true) - $start) . "s\n";

$start = microtime(true);
password_verify($password, $hash);
echo "Verify 2 in " . (microtime(true) - $start) . "s\n";
