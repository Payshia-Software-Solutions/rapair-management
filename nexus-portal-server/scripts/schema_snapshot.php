<?php
/**
 * Writes app/Database/schema.json from your developer Nexus database.
 * Run it after changing a table and commit the file. After deploying, apply it from
 * Nexus admin -> System -> Database (it shows the changes and backs up first).
 *
 *   php scripts/schema_snapshot.php
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../app/Core/Env.php';
require __DIR__ . '/../app/Core/Config.php';
require __DIR__ . '/../app/Services/SchemaService.php';

use App\Services\SchemaService;

$tables = SchemaService::read(SchemaService::pdo());
unset($tables['saas_rate_limits']); // RateLimiter creates it itself
$json = json_encode(['generated_at' => date('Y-m-d H:i:s'), 'tables' => $tables],
    JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if (!is_dir(dirname(SchemaService::snapshotPath()))) mkdir(dirname(SchemaService::snapshotPath()), 0755, true);
file_put_contents(SchemaService::snapshotPath(), $json . "\n");
echo count($tables) . " tables written to app/Database/schema.json\n";
