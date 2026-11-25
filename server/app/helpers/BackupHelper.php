<?php
/**
 * BackupHelper - database backups without mysqldump (works on shared hosting).
 *
 * A backup is a gzip-compressed SQL file: DROP + CREATE for every table, then the rows as
 * INSERT batches, views last. Every statement ends with ";\n" and no value ever contains a raw
 * newline (PDO::quote escapes it), so restore() can split safely on that.
 *
 * Files live in server/storage/backups/<folder>/ (folder = workspace slug, or "main" for a
 * single install), outside the public web root and blocked by an .htaccess as a second guard.
 * Names carry a random part so they cannot be guessed: backup-20261124-020000-ab12cd34.sql.gz
 *
 * Optional off-site copy: set BACKUP_FTP_HOST, BACKUP_FTP_USER, BACKUP_FTP_PASS (and
 * BACKUP_FTP_DIR, BACKUP_FTP_PORT). Use a PRIVATE server, never the public content server.
 * BACKUP_KEEP (default 14) is how many copies are kept per database, locally and off-site.
 */
class BackupHelper {

    public static function root() {
        $dir = APPROOT . '/storage/backups';
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        $ht = $dir . '/.htaccess';
        if (!file_exists($ht)) @file_put_contents($ht, "Require all denied\nDeny from all\n");
        $idx = $dir . '/index.html';
        if (!file_exists($idx)) @file_put_contents($idx, '');
        return $dir;
    }

    public static function folder($name) {
        $name = preg_replace('/[^a-z0-9_-]/i', '', (string)$name) ?: 'main';
        $dir = self::root() . '/' . $name;
        if (!is_dir($dir)) @mkdir($dir, 0750, true);
        return $dir;
    }

    public static function keep() {
        $n = class_exists('Env') ? (int)Env::get('BACKUP_KEEP', 14) : 14;
        return max(1, $n);
    }

    /** Write a backup of the database behind $pdo to $file (.sql.gz). Returns ['tables' => n, 'rows' => n, 'bytes' => n]. */
    public static function dump(PDO $pdo, $dbName, $file) {
        @set_time_limit(0);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $tmp = $file . '.part';
        $gz = gzopen($tmp, 'wb6');
        if (!$gz) throw new Exception('Cannot write the backup file.');
        $w = function ($s) use ($gz) { gzwrite($gz, $s); };

        $w("-- BizFlow database backup\n-- Database: {$dbName}\n-- Created: " . date('Y-m-d H:i:s') . "\n");
        $w("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n");

        $tables = []; $views = [];
        foreach ($pdo->query("SHOW FULL TABLES")->fetchAll(PDO::FETCH_NUM) as $r) {
            if (strtoupper($r[1]) === 'VIEW') $views[] = $r[0]; else $tables[] = $r[0];
        }

        $rowsTotal = 0;
        foreach ($tables as $t) {
            $q = '`' . str_replace('`', '``', $t) . '`';
            $create = $pdo->query("SHOW CREATE TABLE $q")->fetch(PDO::FETCH_NUM)[1];
            $w("\nDROP TABLE IF EXISTS $q;\n" . $create . ";\n");

            // Stream rows without loading the whole table into memory
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
            $st = $pdo->query("SELECT * FROM $q");
            $batch = [];
            $cols = null;
            while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
                if ($cols === null) $cols = '(' . implode(',', array_map(fn($c) => '`' . str_replace('`', '``', $c) . '`', array_keys($row))) . ')';
                $vals = [];
                foreach ($row as $v) $vals[] = $v === null ? 'NULL' : $pdo->quote((string)$v);
                $batch[] = '(' . implode(',', $vals) . ')';
                $rowsTotal++;
                if (count($batch) >= 200) { $w("INSERT INTO $q $cols VALUES " . implode(',', $batch) . ";\n"); $batch = []; }
            }
            if ($batch) $w("INSERT INTO $q $cols VALUES " . implode(',', $batch) . ";\n");
            $st->closeCursor();
            $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, true);
        }

        foreach ($views as $v) {
            $q = '`' . str_replace('`', '``', $v) . '`';
            $create = $pdo->query("SHOW CREATE VIEW $q")->fetch(PDO::FETCH_NUM)[1];
            $create = preg_replace('/DEFINER=`[^`]*`@`[^`]*`\s*/', '', $create); // restore works under any user
            $w("\nDROP VIEW IF EXISTS $q;\n" . $create . ";\n");
        }

        $w("\nSET FOREIGN_KEY_CHECKS = 1;\n-- End of backup\n");
        gzclose($gz);
        if (!@rename($tmp, $file)) { @unlink($tmp); throw new Exception('Cannot finish the backup file.'); }
        return ['tables' => count($tables), 'rows' => $rowsTotal, 'bytes' => filesize($file)];
    }

    /** Make a backup in $folder and prune old ones. Returns the file info. */
    public static function create(PDO $pdo, $dbName, $folder, $protect = null) {
        $dir = self::folder($folder);
        $name = 'backup-' . date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.sql.gz';
        $file = $dir . '/' . $name;
        $stats = self::dump($pdo, $dbName, $file);
        self::prune($dir, $protect);
        $offsite = null;
        try { $offsite = self::offsite($file, $folder); }
        catch (Exception $e) { $offsite = 'failed: ' . $e->getMessage(); error_log('Backup off-site copy: ' . $e->getMessage()); }
        return ['name' => $name, 'size' => $stats['bytes'], 'tables' => $stats['tables'], 'rows' => $stats['rows'], 'offsite' => $offsite];
    }

    /** Keeps the newest keep() copies. $protect (a file name) is never removed, e.g. the one about to be restored. */
    public static function prune($dir, $protect = null) {
        $files = glob($dir . '/backup-*.sql.gz') ?: [];
        rsort($files); // names start with the date, newest first
        foreach (array_slice($files, self::keep()) as $old) {
            if ($protect !== null && basename($old) === $protect) continue;
            @unlink($old);
        }
    }

    public static function listFiles($folder) {
        $dir = self::folder($folder);
        $out = [];
        foreach (glob($dir . '/backup-*.sql.gz') ?: [] as $f) {
            $out[] = ['name' => basename($f), 'size' => filesize($f), 'created_at' => date('Y-m-d H:i:s', filemtime($f))];
        }
        usort($out, fn($a, $b) => strcmp($b['name'], $a['name']));
        return $out;
    }

    /** Full path of a backup in $folder, or null when the name is not a backup file there. */
    public static function path($folder, $name) {
        if (!preg_match('/^backup-\d{8}-\d{6}-[a-f0-9]{8}\.sql\.gz$/', (string)$name)) return null;
        $f = self::folder($folder) . '/' . $name;
        return is_file($f) ? $f : null;
    }

    /** Copy to the private off-site FTP server, keeping the same number of copies there. */
    private static function offsite($file, $folder) {
        if (!class_exists('Env') || !Env::get('BACKUP_FTP_HOST') || !Env::get('BACKUP_FTP_PASS')) return null;
        $connect = function_exists('ftp_ssl_connect') ? 'ftp_ssl_connect' : 'ftp_connect';
        $c = @$connect(Env::get('BACKUP_FTP_HOST'), Env::int('BACKUP_FTP_PORT', 21), 30);
        if (!$c) throw new Exception('cannot connect');
        try {
            if (!@ftp_login($c, Env::get('BACKUP_FTP_USER', ''), Env::get('BACKUP_FTP_PASS'))) throw new Exception('login failed');
            @ftp_pasv($c, true);
            $dir = trim(Env::get('BACKUP_FTP_DIR', 'bizflow-backups'), '/') . '/' . preg_replace('/[^a-z0-9_-]/i', '', $folder);
            $path = '';
            foreach (explode('/', $dir) as $part) {
                if ($part === '') continue;
                $path .= ($path === '' ? '' : '/') . $part;
                @ftp_mkdir($c, $path);
            }
            if (!@ftp_put($c, $dir . '/' . basename($file), $file, FTP_BINARY)) throw new Exception('upload failed');
            $remote = array_filter(@ftp_nlist($c, $dir) ?: [], fn($n) => preg_match('/backup-\d{8}-\d{6}-[a-f0-9]{8}\.sql\.gz$/', $n));
            $remote = array_map('basename', $remote);
            rsort($remote);
            foreach (array_slice($remote, self::keep()) as $old) @ftp_delete($c, $dir . '/' . $old);
            return 'copied';
        } finally {
            @ftp_close($c);
        }
    }

    /** Load a backup into the database behind $pdo (replaces every table in the file). */
    public static function restore(PDO $pdo, $file) {
        @set_time_limit(0);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $gz = gzopen($file, 'rb');
        if (!$gz) throw new Exception('Cannot read the backup file.');
        $buf = '';
        $n = 0;
        try {
            while (!gzeof($gz)) {
                $line = gzgets($gz, 1 << 22);
                if ($line === false) break;
                if ($buf === '' && (strncmp($line, '--', 2) === 0 || trim($line) === '')) continue;
                $buf .= $line;
                // A statement ends with ";" at a real line end (a very long line can arrive in pieces)
                if (substr($line, -1) === "\n" && substr(rtrim($line, "\r\n"), -1) === ';') {
                    $pdo->exec($buf);
                    $buf = '';
                    $n++;
                }
            }
            if (trim($buf) !== '') { $pdo->exec($buf); $n++; }
        } finally {
            gzclose($gz);
            try { $pdo->exec('SET FOREIGN_KEY_CHECKS = 1'); } catch (Exception $e) {}
        }
        return $n;
    }
}
