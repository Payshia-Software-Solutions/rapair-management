<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$res = $db->query('SHOW TABLES');
$tables = $res->fetchAll(PDO::FETCH_COLUMN);

$artifactPath = 'C:/Users/Thilina-Laptop/.gemini/antigravity/brain/41867bb1-dff2-4d3c-8acc-e96325063eba/database_schema.md';
$fp = fopen($artifactPath, 'w');

fwrite($fp, "# Full Database Schema Definition\n\n");
fwrite($fp, "This document provides a comprehensive view of all tables in the `repair_management_db` database, retrieved directly via `SHOW TABLES` and `DESCRIBE`.\n\n");

foreach ($tables as $table) {
    fwrite($fp, "## Table: `$table`\n\n");
    
    // Columns
    fwrite($fp, "### Columns\n\n");
    fwrite($fp, "| Field | Type | Null | Key | Default | Extra |\n");
    fwrite($fp, "| :--- | :--- | :--- | :--- | :--- | :--- |\n");
    $resCol = $db->query("DESCRIBE `$table` ");
    while ($c = $resCol->fetch(PDO::FETCH_ASSOC)) {
        $def = $c['Default'] === null ? '*NULL*' : '`' . $c['Default'] . '`';
        fwrite($fp, "| {$c['Field']} | {$c['Type']} | {$c['Null']} | {$c['Key']} | $def | {$c['Extra']} |\n");
    }
    
    // Indexes
    fwrite($fp, "\n### Indexes\n\n");
    fwrite($fp, "| Key Name | Non Unique | Column Name | Index Type |\n");
    fwrite($fp, "| :--- | :--- | :--- | :--- |\n");
    $resIdx = $db->query("SHOW INDEX FROM `$table` ");
    while ($i = $resIdx->fetch(PDO::FETCH_ASSOC)) {
        fwrite($fp, "| {$i['Key_name']} | {$i['Non_unique']} | {$i['Column_name']} | {$i['Index_type']} |\n");
    }
    
    fwrite($fp, "\n---\n\n");
}

fclose($fp);
echo "Database schema definition artifact updated.\n";
