<?php
$db = new PDO('mysql:host=localhost;dbname=repair_management_db', 'root', '');
$res = $db->query('SHOW TABLES');
$tables = $res->fetchAll(PDO::FETCH_COLUMN);

$schema = [];
foreach ($tables as $table) {
    $tableInfo = [
        'name' => $table,
        'columns' => [],
        'indexes' => []
    ];
    $resCol = $db->query("DESCRIBE `$table` ");
    while ($c = $resCol->fetch(PDO::FETCH_ASSOC)) {
        $tableInfo['columns'][$c['Field']] = $c;
    }
    $resIdx = $db->query("SHOW INDEX FROM `$table` ");
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
    $schema[$table] = $tableInfo;
}

$content = "<?php\n\nclass SchemaDefinition {\n    public static function get() {\n        return " . var_export($schema, true) . ";\n    }\n}\n";
file_put_contents('c:/xampp/htdocs/rapair-management/server/app/core/SchemaDefinition.php', $content);
echo "Hard-coded schema definition generated at server/app/core/SchemaDefinition.php\n";
