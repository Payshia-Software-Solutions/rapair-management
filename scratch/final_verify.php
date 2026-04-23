<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';

$db = new Database();
$db->query("SELECT * FROM hr_salary_templates");
$rows = $db->resultSet();

if (empty($rows)) {
    echo "NO SCHEMES FOUND IN DATABASE.\n";
} else {
    echo "FOUND " . count($rows) . " SCHEMES:\n";
    foreach ($rows as $row) {
        echo "- ID: {$row->id}, Name: {$row->name}\n";
    }
}
