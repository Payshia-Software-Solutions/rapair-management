<?php
namespace App\Services;

use App\Core\Config;
use PDO;

/**
 * Keeps the Nexus database in step with the code.
 *
 * app/Database/schema.json is the schema the code expects (made from a developer database with
 * `php scripts/schema_snapshot.php`). diff() compares the live database with it; update() takes a
 * full backup and then adds what is missing. Only adds tables, columns and indexes: nothing is
 * dropped, renamed or altered, so existing data is never touched.
 */
class SchemaService {
    const KEEP = 10;

    public static function snapshotPath() { return dirname(__DIR__) . '/Database/schema.json'; }
    public static function backupDir() { return dirname(__DIR__, 2) . '/storage/backups/nexus'; }

    public static function pdo() {
        return new PDO('mysql:host=' . Config::DB_HOST() . ';dbname=' . Config::DB_NAME() . ';charset=utf8mb4',
            Config::DB_USER(), Config::DB_PASS(),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    }

    public static function q($n) { return '`' . str_replace('`', '``', $n) . '`'; }

    /** Structure of every table: create statement, column definitions (in order) and indexes. */
    public static function read(PDO $pdo) {
        $out = [];
        foreach ($pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_NUM) as $r) {
            $create = $pdo->query('SHOW CREATE TABLE ' . self::q($r[0]))->fetch(PDO::FETCH_NUM)[1];
            $create = preg_replace('/ AUTO_INCREMENT=\d+/', '', $create);
            $cols = []; $idx = [];
            foreach (explode("\n", $create) as $line) {
                $line = rtrim(trim($line), ',');
                if (preg_match('/^`((?:[^`]|``)+)` (.+)$/', $line, $m)) {
                    $cols[str_replace('``', '`', $m[1])] = $m[2];
                } elseif (preg_match('/^(UNIQUE |FULLTEXT |SPATIAL )?KEY `((?:[^`]|``)+)` \((.+)\)/', $line, $m)) {
                    $idx[str_replace('``', '`', $m[2])] = [
                        'sql' => $line,
                        'unique' => trim($m[1]) === 'UNIQUE',
                        'columns' => array_map(fn($c) => trim(preg_replace('/\(\d+\)$/', '', trim($c)), '`'), explode(',', $m[3])),
                    ];
                }
            }
            $out[$r[0]] = ['create' => $create, 'columns' => $cols, 'indexes' => $idx];
        }
        ksort($out);
        return $out;
    }

    public static function snapshot() {
        $f = self::snapshotPath();
        if (!is_file($f)) throw new \RuntimeException('app/Database/schema.json is missing. Deploy it with the code.');
        $s = json_decode(file_get_contents($f), true);
        if (!is_array($s) || !isset($s['tables'])) throw new \RuntimeException('app/Database/schema.json is not valid.');
        return $s;
    }

    /** What the live database is missing compared with schema.json (read-only). */
    public static function diff(PDO $pdo = null) {
        $pdo = $pdo ?: self::pdo();
        $want = self::snapshot();
        $have = self::read($pdo);
        $tables = []; $columns = []; $indexes = [];
        foreach ($want['tables'] as $t => $def) {
            if (!isset($have[$t])) { $tables[] = $t; continue; }
            $prev = null;
            foreach ($def['columns'] as $c => $sql) {
                if (!isset($have[$t]['columns'][$c])) $columns[] = ['table' => $t, 'column' => $c, 'definition' => $sql, 'after' => $prev];
                $prev = $c;
            }
            foreach ($def['indexes'] as $i => $ix) {
                if (!isset($have[$t]['indexes'][$i])) $indexes[] = ['table' => $t, 'index' => $i, 'columns' => $ix['columns'], 'unique' => $ix['unique']];
            }
        }
        $d = ['missing_tables' => $tables, 'missing_columns' => $columns, 'missing_indexes' => $indexes];
        $d['fingerprint'] = hash('sha256', json_encode($d));
        $d['snapshot_date'] = $want['generated_at'] ?? null;
        $d['last_backup'] = self::backups()[0] ?? null;
        return $d;
    }

    /** Back up, then apply exactly the reviewed changes. Refuses if the list changed since the review. */
    public static function update($fingerprint) {
        @set_time_limit(0);
        $pdo = self::pdo();
        $d = self::diff($pdo);
        if (!hash_equals($d['fingerprint'], (string)$fingerprint)) {
            throw new \InvalidArgumentException('The database changed since you reviewed it. Check for updates again.');
        }
        if (!$d['missing_tables'] && !$d['missing_columns'] && !$d['missing_indexes']) {
            return ['backup' => null, 'applied' => [], 'errors' => [], 'remaining' => 0];
        }

        $backup = self::backup($pdo); // throws, so nothing changes when the backup fails

        $want = self::snapshot()['tables'];
        $applied = []; $errors = [];
        $run = function ($sql, $label) use ($pdo, &$applied, &$errors) {
            try { $pdo->exec($sql); $applied[] = $label; }
            catch (\Throwable $e) { $errors[] = "$label: " . $e->getMessage(); }
        };
        foreach ($d['missing_tables'] as $t) {
            $run(preg_replace('/^CREATE TABLE /', 'CREATE TABLE IF NOT EXISTS ', $want[$t]['create']), "table $t");
        }
        foreach ($d['missing_columns'] as $c) {
            $run('ALTER TABLE ' . self::q($c['table']) . ' ADD COLUMN ' . self::q($c['column']) . ' ' . $c['definition']
                . ($c['after'] ? ' AFTER ' . self::q($c['after']) : ' FIRST'), "column {$c['table']}.{$c['column']}");
        }
        foreach ($d['missing_indexes'] as $i) {
            $run('ALTER TABLE ' . self::q($i['table']) . ' ADD ' . $want[$i['table']]['indexes'][$i['index']]['sql'], "index {$i['table']}.{$i['index']}");
        }
        $after = self::diff($pdo);
        $remaining = count($after['missing_tables']) + count($after['missing_columns']) + count($after['missing_indexes']);
        return ['backup' => $backup, 'applied' => $applied, 'errors' => $errors, 'remaining' => $remaining];
    }

    /** Full gzip SQL dump of the Nexus database into storage/backups/nexus (keeps the latest KEEP). */
    public static function backup(PDO $pdo) {
        @set_time_limit(0);
        $dir = self::backupDir();
        if (!is_dir($dir) && !@mkdir($dir, 0750, true)) throw new \RuntimeException('Cannot create storage/backups/nexus. Make storage/ writable.');
        $deny = dirname($dir, 2) . '/.htaccess';
        if (!is_file($deny)) @file_put_contents($deny, "Require all denied\n");

        $name = 'nexus_' . date('Ymd_His') . '.sql.gz';
        $file = "$dir/$name"; $tmp = "$file.part";
        $gz = gzopen($tmp, 'wb6');
        if (!$gz) throw new \RuntimeException('Cannot write the backup file.');
        gzwrite($gz, "-- Nexus database backup\n-- Created: " . date('Y-m-d H:i:s') . "\n"
            . "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n");
        $tables = 0; $rows = 0;
        foreach ($pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(PDO::FETCH_NUM) as $r) {
            $q = self::q($r[0]); $tables++;
            gzwrite($gz, "\nDROP TABLE IF EXISTS $q;\n" . $pdo->query("SHOW CREATE TABLE $q")->fetch(PDO::FETCH_NUM)[1] . ";\n");
            $st = $pdo->query("SELECT * FROM $q");
            $batch = []; $cols = null;
            while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
                if ($cols === null) $cols = '(' . implode(',', array_map([self::class, 'q'], array_keys($row))) . ')';
                $batch[] = '(' . implode(',', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote((string)$v), $row)) . ')';
                $rows++;
                if (count($batch) >= 200) { gzwrite($gz, "INSERT INTO $q $cols VALUES " . implode(',', $batch) . ";\n"); $batch = []; }
            }
            if ($batch) gzwrite($gz, "INSERT INTO $q $cols VALUES " . implode(',', $batch) . ";\n");
        }
        gzwrite($gz, "\nSET FOREIGN_KEY_CHECKS = 1;\n-- End of backup\n");
        gzclose($gz);
        if (!@rename($tmp, $file)) { @unlink($tmp); throw new \RuntimeException('Cannot finish the backup file.'); }
        foreach (array_slice(self::backups(), self::KEEP) as $old) @unlink("$dir/{$old['name']}");
        return ['name' => $name, 'size' => filesize($file), 'created_at' => date('Y-m-d H:i:s'), 'tables' => $tables, 'rows' => $rows];
    }

    public static function backups() {
        $out = [];
        foreach (glob(self::backupDir() . '/nexus_*.sql.gz') ?: [] as $f) {
            $out[] = ['name' => basename($f), 'size' => filesize($f), 'created_at' => date('Y-m-d H:i:s', filemtime($f))];
        }
        usort($out, fn($a, $b) => strcmp($b['name'], $a['name']));
        return $out;
    }
}
