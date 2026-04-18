<?php
$file = 'c:/xampp/htdocs/rapair-management/server/app/controllers/ReportController.php';
$content = file_get_contents($file);
$content = str_replace(
    'p.id AS part_id,', 
    "p.id AS id,\n              p.id AS part_id,", 
    $content
);
file_put_contents($file, $content);
echo "Updated ReportController.php\n";
