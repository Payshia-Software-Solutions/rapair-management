<?php
$content = file_get_contents('c:/xampp/htdocs/rapair-management/scratch/full_schema_raw.txt');
// Conversion from UTF-16LE if needed, but since I used php > file it should be UTF-8 or current system encoding.
// Let's assume it's readable.

$artifactPath = 'C:/Users/Thilina-Laptop/.gemini/antigravity/brain/41867bb1-dff2-4d3c-8acc-e96325063eba/database_schema.md';
$fp = fopen($artifactPath, 'w');
fwrite($fp, "# Full Database Schema Audit\n\n");
fwrite($fp, "This document contains the detailed structure of all tables in the `repair_management_db` database.\n\n");

$lines = explode("\n", $content);
$currentTable = '';

foreach ($lines as $line) {
    if (preg_match('/^TABLE: (.+)$/', $line, $matches)) {
        $currentTable = $matches[1];
        fwrite($fp, "## Table: `$currentTable`\n\n");
    } elseif (strpos($line, '--- Structure ---') !== false) {
        fwrite($fp, "### Columns\n\n| Field | Type | Null | Key | Default | Extra |\n|---|---|---|---|---|---|\n");
    } elseif (strpos($line, '--- Indexes ---') !== false) {
        fwrite($fp, "\n### Indexes\n\n| Key Name | Non Unique | Column Name | Index Type |\n|---|---|---|---|\n");
    } elseif (strpos($line, '|') !== false && strpos($line, '---') === false && strpos($line, 'Field') === false && strpos($line, 'Key_name') === false) {
        $parts = array_map('trim', explode('|', $line));
        fwrite($fp, "| " . implode(" | ", $parts) . " |\n");
    }
}

fclose($fp);
echo "Artifact created at: $artifactPath\n";
