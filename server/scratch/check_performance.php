<?php
require_once 'app/core/Database.php';
require_once 'config/config.php';

$db = new Database();

echo "--- TABLE STATISTICS ---\n";
try {
    $db->query("SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH 
                FROM information_schema.TABLES 
                WHERE TABLE_SCHEMA = '" . DB_NAME . "' 
                ORDER BY TABLE_ROWS DESC
                LIMIT 50");
    $tables = $db->resultSet();

    foreach ($tables as $table) {
        printf("%-30s | Rows: %10d | Data: %10.2f MB | Index: %10.2f MB\n", 
            $table->TABLE_NAME, 
            $table->TABLE_ROWS, 
            $table->DATA_LENGTH / 1024 / 1024, 
            $table->INDEX_LENGTH / 1024 / 1024
        );
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n--- MISSING INDEXES ON FOREIGN KEYS (POTENTIAL) ---\n";
// This is a heuristic: columns ending in _id that are not part of an index
try {
    $sql = "SELECT TABLE_NAME, COLUMN_NAME 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = '" . DB_NAME . "' 
            AND COLUMN_NAME LIKE '%\_id' 
            AND COLUMN_NAME != 'id'
            AND (TABLE_NAME, COLUMN_NAME) NOT IN (
                SELECT TABLE_NAME, COLUMN_NAME 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = '" . DB_NAME . "'
            )";
    $db->query($sql);
    $missing = $db->resultSet();
    if (empty($missing)) {
        echo "No obvious missing foreign key indexes found based on naming convention.\n";
    } else {
        foreach ($missing as $m) {
            echo "Potential missing index: {$m->TABLE_NAME}({$m->COLUMN_NAME})\n";
        }
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}

echo "\n--- LARGE TABLES WITH NO INDEXES (BESIDES PRIMARY) ---\n";
try {
    $sql = "SELECT TABLE_NAME, TABLE_ROWS
            FROM information_schema.TABLES t
            WHERE TABLE_SCHEMA = '" . DB_NAME . "'
            AND (SELECT COUNT(*) FROM information_schema.STATISTICS s WHERE s.TABLE_SCHEMA = t.TABLE_SCHEMA AND s.TABLE_NAME = t.TABLE_NAME) = 1
            AND TABLE_ROWS > 100
            ORDER BY TABLE_ROWS DESC";
    $db->query($sql);
    $unindexed = $db->resultSet();
    foreach ($unindexed as $u) {
        echo "Large table with only 1 index: {$u->TABLE_NAME} ({$u->TABLE_ROWS} rows)\n";
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
