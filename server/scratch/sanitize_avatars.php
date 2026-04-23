<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

$db = new Database();
// Select all employees with an avatar_url that contains a path separator
$db->query("SELECT id, avatar_url FROM employees WHERE avatar_url LIKE '%/%'");
$employees = $db->resultSet();

echo "Found " . count($employees) . " records to sanitize.\n";

$db->beginTransaction();
try {
    foreach ($employees as $emp) {
        $filename = basename($emp->avatar_url);
        echo "Sanitizing ID {$emp->id}: {$emp->avatar_url} -> {$filename}\n";
        
        $db->query("UPDATE employees SET avatar_url = :avatar WHERE id = :id");
        $db->bind(':avatar', $filename);
        $db->bind(':id', $emp->id);
        $db->execute();
    }
    $db->commit();
    echo "Sanitization complete successfully.\n";
} catch (Exception $e) {
    $db->rollBack();
    echo "Error during sanitization: " . $e->getMessage() . "\n";
}
