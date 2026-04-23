<?php
require_once 'config/config.php';
require_once 'app/core/Database.php';

$db = new Database();
// Select all documents where file_path looks like a directory path
$db->query("SELECT id, file_path FROM hr_employee_documents WHERE file_path LIKE '%/%'");
$docs = $db->resultSet();

echo "Found " . count($docs) . " records to sanitize.\n";

$db->beginTransaction();
try {
    foreach ($docs as $d) {
        $filename = basename($d->file_path);
        echo "Sanitizing ID {$d->id}: {$d->file_path} -> {$filename}\n";
        
        $db->query("UPDATE employee_documents SET file_path = :path WHERE id = :id");
        $db->bind(':path', $filename);
        $db->bind(':id', $d->id);
        $db->execute();
    }
    $db->commit();
    echo "Sanitization complete successfully.\n";
} catch (Exception $e) {
    $db->rollBack();
    echo "Error during sanitization: " . $e->getMessage() . "\n";
}
