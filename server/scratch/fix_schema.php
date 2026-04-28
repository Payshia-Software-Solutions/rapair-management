<?php
require_once dirname(__FILE__) . '/../config/config.php';
require_once dirname(__FILE__) . '/../app/core/Database.php';

$db = new Database();
$res = $db->rawQuery("SHOW TABLES");
$tables = $res->fetchAll(PDO::FETCH_COLUMN);

$newSchema = [];
foreach ($tables as $table) {
    $tableInfo = [
        'name' => $table,
        'columns' => [],
        'indexes' => []
    ];
    // Columns
    $resCol = $db->rawQuery("DESCRIBE `$table` ");
    while ($c = $resCol->fetch(PDO::FETCH_ASSOC)) {
        $tableInfo['columns'][$c['Field']] = $c;
    }
    // Indexes
    try {
        $resIdx = $db->rawQuery("SHOW INDEX FROM `$table` ");
        while ($i = $resIdx->fetch(PDO::FETCH_ASSOC)) {
            $key = $i['Key_name'];
            if (!isset($tableInfo['indexes'][$key])) {
                $tableInfo['indexes'][$key] = [
                    'Key_name' => $key,
                    'Non_unique' => $i['Non_unique'],
                    'Columns' => []
                ];
            }
            $tableInfo['indexes'][$key]['Columns'][] = $i['Column_name'];
        }
    } catch (Exception $e) {
        // Some views might not have indexes
    }
    $newSchema[$table] = $tableInfo;
}

ksort($newSchema);

$code = "<?php\n\nclass SchemaDefinition {\n    public static function get() {\n        return " . var_export($newSchema, true) . ";\n    }\n}\n";
$filePath = dirname(__FILE__) . '/../app/core/SchemaDefinition.php';
$jsonPath = dirname(__FILE__) . '/../app/core/schema_snapshot.json';

$success = true;
if (file_put_contents($filePath, $code)) {
    echo "SUCCESS: Updated SchemaDefinition.php with " . count($newSchema) . " tables.\n";
} else {
    echo "ERROR: Failed to write SchemaDefinition.php\n";
    $success = false;
}

if (file_put_contents($jsonPath, json_encode($newSchema, JSON_PRETTY_PRINT))) {
    echo "SUCCESS: Updated schema_snapshot.json with " . count($newSchema) . " tables.\n";
} else {
    echo "ERROR: Failed to write schema_snapshot.json\n";
    $success = false;
}
