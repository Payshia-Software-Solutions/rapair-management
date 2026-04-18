<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();

echo "Checking document_sequences for 'REF'...\n";
try {
    $db->query("SELECT * FROM document_sequences WHERE doc_type = 'REF'");
    $res = $db->single();

    if ($res) {
        echo "FOUND: " . json_encode($res) . "\n";
    } else {
        echo "NOT FOUND!\n";
        echo "Initializing sequence...\n";
        $db->query("INSERT IGNORE INTO document_sequences (doc_type, prefix, next_number, padding) VALUES ('REF', 'REF-', 1, 5)");
        $db->execute();
        echo "DONE\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
