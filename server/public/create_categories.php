<?php
define('APPROOT', dirname(dirname(__DIR__)) . '/server');
require_once APPROOT . '/config/config.php';
require_once APPROOT . '/app/core/Database.php';

$db = new Database();
$db->query("CREATE TABLE IF NOT EXISTS logistics_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");
$db->execute();

// Insert default categories
$defaults = ['Logistic', 'Clearence', 'Freight', 'General'];
foreach ($defaults as $name) {
    $db->query("INSERT IGNORE INTO logistics_categories (name) VALUES (:name)");
    $db->bind(':name', $name);
    $db->execute();
}

echo "Table logistics_categories created and defaults inserted.\n";
