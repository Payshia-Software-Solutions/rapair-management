<?php
/**
 * Company Controller
 *
 * Endpoints:
 * - GET  /api/company/get
 * - POST /api/company/update
 */
class CompanyController extends Controller {
    private $companyModel;
    private $auditModel;

    public function __construct() {
        $this->companyModel = $this->model('Company');
        $this->auditModel = $this->model('AuditLog');
    }

    public function get() {
        $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $row = $this->companyModel->get();
        $this->success($row);
    }

    public function update() {
        $u = $this->requirePermission('company.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $name = trim((string)($data['name'] ?? ''));
        
        // Transform tax_ids array to JSON if present
        if (isset($data['tax_ids']) && is_array($data['tax_ids'])) {
            $data['tax_ids_json'] = json_encode($data['tax_ids']);
        }

        $ok = $this->companyModel->update($data, (int)$u['sub']);
        if (!$ok) {
            $this->error('Failed to update company');
            return;
        }
        $this->auditModel->write([
            'user_id' => (int)$u['sub'],
            'location_id' => null,
            'action' => 'update',
            'entity' => 'company',
            'entity_id' => 1,
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'details' => json_encode(['name' => $name, 'tax_ids' => $data['tax_ids'] ?? null]),
        ]);
        $this->success(null, 'Company updated');
    }

    // POST /api/company/upload_logo (field: logo) -> stored in content/company, saved as logo_filename
    // POST /api/company/upload_logo with remove=1 clears it.
    public function upload_logo() {
        $u = $this->requirePermission('company.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { $this->error('Method Not Allowed', 405); return; }
        if (!empty($_POST['remove'])) {
            $this->companyModel->update(['logo_filename' => ''], (int)$u['sub']);
            $this->success(['filename' => null], 'Logo removed');
            return;
        }
        $f = $_FILES['logo'] ?? null;
        if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
            $err = $f['error'] ?? null;
            $this->error(($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) ? 'File too large' : 'Choose an image to upload', 400);
            return;
        }
        if ((int)$f['size'] > 2 * 1024 * 1024) { $this->error('Logo must be 2 MB or smaller', 400); return; }
        $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp'], true) || @getimagesize($f['tmp_name']) === false) {
            $this->error('Use a PNG, JPG or WEBP image', 400);
            return;
        }
        $filename = 'logo_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
        // Content server (FTP) when configured; otherwise keep it on this server under public/uploads/company
        if (defined('FTP_HOST') && defined('FTP_PASS') && FTP_PASS) {
            try {
                require_once '../app/helpers/FtpStorage.php';
                $ftp = new FtpStorage();
                $ftp->upload($f['tmp_name'], 'company', $filename);
            } catch (Throwable $e) {
                $this->error('Upload failed: ' . $e->getMessage(), 500);
                return;
            }
            $stored = $filename;
            $url = rtrim(CONTENT_BASE_URL, '/') . '/company/' . $filename;
        } else {
            // The shared deployment keeps files off the app server: no FTP means no upload
            if (class_exists('Tenancy', false) && Tenancy::enabled()) { $this->error('File storage is not set up yet. Please contact support.', 500); return; }
            // Per workspace on the shared deployment; public/uploads/company otherwise
            [$dir, $relDir] = class_exists('Tenancy', false) ? Tenancy::uploadDir('company') : [__DIR__ . '/../../public/uploads/company', 'uploads/company'];
            if (!is_dir($dir) && !@mkdir($dir, 0775, true)) { $this->error('Could not create the uploads folder', 500); return; }
            if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $filename)) { $this->error('Could not save the logo', 500); return; }
            $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
            $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
            // Full URL is stored, so receipts/printer app load it directly (contentUrl passes http URLs through)
            $url = ($https ? 'https' : 'http') . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base . '/' . $relDir . '/' . $filename;
            $stored = $url;
        }
        $this->companyModel->update(['logo_filename' => $stored], (int)$u['sub']);
        $this->success(['filename' => $stored, 'url' => $url], 'Logo uploaded');
    }

    public function getTaxes() {
        $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        $taxes = $this->companyModel->getTaxes(1);
        $this->success($taxes);
    }
}

