<?php
define('BASE_PATH', __DIR__);
require_once BASE_PATH . '/config/config.php';
require_once BASE_PATH . '/app/core/Database.php';

$db = new Database();
$db->query("UPDATE document_sequences SET prefix = 'EXPQT-' WHERE doc_type = 'QT'");
if($db->execute()) {
    echo "Prefix updated to EXPQT- for doc_type QT.\n";
} else {
    echo "Failed to update prefix.\n";
}
