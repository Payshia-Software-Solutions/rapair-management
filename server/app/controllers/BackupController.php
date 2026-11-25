<?php
/**
 * BackupController - database backups of this workspace (route /api/backup/...). Admin only.
 *
 *   GET  /api/backup/list               backups kept on the server (newest first) + settings
 *   POST /api/backup/create             make a backup now
 *   GET  /api/backup/download?name=     download one backup (.sql.gz)
 *
 * Nightly backups come from cron/backup.php. Restoring is command-line only (cron/restore.php),
 * so a stolen admin session can download data but never overwrite it.
 */
require_once __DIR__ . '/../helpers/BackupHelper.php';

class BackupController extends Controller {
    private $auditModel;

    public function __construct() {
        $this->auditModel = $this->model('AuditLog');
    }

    private function admin() {
        $u = $this->requireAuth();
        if (!$this->isAdmin($u)) { $this->error('Only administrators can manage backups.', 403); }
        return $u;
    }

    /** Folder of the current database: the workspace slug in shared mode, "main" otherwise. */
    private function folder() {
        return (class_exists('Tenancy', false) && Tenancy::enabled()) ? Tenancy::slug() : 'main';
    }

    public function index() { $this->list(); }

    public function list() {
        $this->admin();
        $files = BackupHelper::listFiles($this->folder());
        $this->success([
            'backups' => $files,
            'keep' => BackupHelper::keep(),
            'offsite' => class_exists('Env') && Env::get('BACKUP_FTP_HOST') ? true : false,
            'last' => $files[0]['created_at'] ?? null,
        ]);
    }

    public function create() {
        $u = $this->admin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') { $this->error('Method Not Allowed', 405); }
        try {
            $pdo = new PDO("mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
            $r = BackupHelper::create($pdo, DB_NAME, $this->folder());
            $this->auditModel->write([
                'user_id' => (int)$u['sub'], 'action' => 'backup_create', 'entity' => 'database', 'entity_id' => 0,
                'method' => 'POST', 'path' => $_SERVER['REQUEST_URI'] ?? '', 'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
                'details' => json_encode(['name' => $r['name'], 'size' => $r['size']]),
            ]);
            $this->success($r, 'Backup created');
        } catch (Throwable $e) {
            error_log('Backup failed: ' . $e->getMessage());
            $this->error('Backup failed: ' . $e->getMessage(), 500);
        }
    }

    public function download() {
        $u = $this->admin();
        $path = BackupHelper::path($this->folder(), $_GET['name'] ?? '');
        if (!$path) { $this->error('Backup not found', 404); }
        $this->auditModel->write([
            'user_id' => (int)$u['sub'], 'action' => 'backup_download', 'entity' => 'database', 'entity_id' => 0,
            'method' => 'GET', 'path' => $_SERVER['REQUEST_URI'] ?? '', 'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'details' => json_encode(['name' => basename($path)]),
        ]);
        while (ob_get_level()) ob_end_clean();
        header('Content-Type: application/gzip');
        header('Content-Disposition: attachment; filename="' . basename($path) . '"');
        header('Content-Length: ' . filesize($path));
        header('Cache-Control: no-store');
        readfile($path);
        exit;
    }
}
