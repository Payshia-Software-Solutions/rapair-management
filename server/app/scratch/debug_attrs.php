<?php
require '../../config/config.php';
require '../libraries/Database.php';

$db = new Database();
echo "--- GROUPS ---\n";
$db->query("SELECT * FROM attribute_groups");
print_r($db->resultSet());

echo "\n--- ATTRIBUTES ---\n";
$db->query("SELECT * FROM attributes");
print_r($db->resultSet());

echo "\n--- VALUES FOR PART 2 ---\n";
$db->query("SELECT * FROM part_attribute_values WHERE part_id = 2");
print_r($db->resultSet());
