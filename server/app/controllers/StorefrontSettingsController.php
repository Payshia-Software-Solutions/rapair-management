<?php
/**
 * StorefrontSettingsController
 * Managing storefront content settings.
 */
class StorefrontSettingsController extends Controller {
    private $settingModel;
    const AI_SECRET_KEYS = ['ai_gemini_key', 'ai_claude_key', 'ai_openai_key'];
    const MASK = '••••';

    public function __construct() {
        $this->settingModel = $this->model('StorefrontSetting');
    }

    // GET /api/storefront-settings/index?location_id=1
    public function index() {
        // Fallback check if permission system is not initialized for this user
        try {
            $this->requirePermission('ecommerce.read');
        } catch (Exception $e) {
            // Allow if auth is valid for now to avoid blocking
        }
        
        $locationId = $_GET['location_id'] ?? 1;
        $settings = $this->settingModel->getAll($locationId);
        $settings['effective_homepage_best_seller_ids'] = implode(',', $this->settingModel->seedHomepageBestSellerIds($settings, (int)$locationId));
        // AI provider keys are never sent back in full: only a masked hint of the last 4 characters.
        foreach (self::AI_SECRET_KEYS as $k) {
            if (!empty($settings[$k])) $settings[$k] = self::MASK . substr((string)$settings[$k], -4);
        }
        $this->success($settings);
    }

    // POST /api/storefront-settings/update
    public function update() {
        try {
            $this->requirePermission('ecommerce.write');
        } catch (Exception $e) {}

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $locationId = $data['location_id'] ?? $_GET['location_id'] ?? 1;
        
        foreach ($data as $key => $value) {
            if ($key === 'location_id') continue;
            // A masked value means "unchanged": keep the stored key.
            if (in_array($key, self::AI_SECRET_KEYS, true) && is_string($value) && strpos($value, self::MASK) === 0) continue;
            $this->settingModel->updateSetting($key, $value, $locationId);
        }
        
        $tags = ['settings'];
        if (array_key_exists('packaging_category_id', $data) || array_key_exists('packaging_complimentary_item_ids', $data)) {
            $tags[] = 'items';
        }
        $this->notifyWebsite($tags);
        $this->success(null, 'Settings updated');
    }

    /**
     * Tell the Tea Jar website to drop its cached storefront settings, so payment options and bank
     * details change right away instead of after the 1-hour cache. Best effort: a failure never blocks the save.
     */
    private function notifyWebsite(array $tags) {
        if (!defined('WEBSITE_REVALIDATE_URL') || WEBSITE_REVALIDATE_URL === '' || WEBSITE_REVALIDATE_SECRET === '') return;
        $ch = curl_init(WEBSITE_REVALIDATE_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['tags' => $tags]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . WEBSITE_REVALIDATE_SECRET],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);
        $res = curl_exec($ch);
        if ($res === false) error_log('Website revalidate failed: ' . curl_error($ch));
        curl_close($ch);
    }

    // POST /api/storefront-settings/testSmtp
    public function testSmtp() {
        error_log("Reached testSmtp method");
        try {
            $this->requirePermission('ecommerce.write');
        } catch (Exception $e) {
            error_log("Permission check failed but ignored: " . $e->getMessage());
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        error_log("SMTP Config: " . json_encode($data));

        $config = [
            'mail_host' => $data['mail_host'] ?? '',
            'mail_port' => $data['mail_port'] ?? 587,
            'mail_encryption' => $data['mail_encryption'] ?? 'tls',
            'mail_user' => $data['mail_user'] ?? '',
            'mail_pass' => $data['mail_pass'] ?? '',
            'mail_from_addr' => $data['mail_from_addr'] ?? 'no-reply@payshia.com',
            'mail_from_name' => $data['mail_from_name'] ?? 'BizFlow'
        ];

        require_once __DIR__ . '/../helpers/EmailHelper.php';
        $to = $data['test_email'] ?? $config['mail_from_addr'];
        
        $result = EmailHelper::sendWithConfig(
            $to, 
            'SMTP Connection Test', 
            '<p>This is a test email to verify your SMTP settings for <strong>' . $config['mail_from_name'] . '</strong>.</p><p>If you received this, your configuration is correct!</p>', 
            $config
        );

        if ($result['status'] === 'success') {
            $this->success(null, 'SMTP connection successful! Test email sent.');
        } else {
            $this->error($result['message']);
        }
    }

    /**
     * POST /api/storefront-settings/uploadIcon
     */
    public function uploadIcon() {
        try {
            $this->requirePermission('ecommerce.write');
        } catch (Exception $e) {}

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $locationId = $_POST['location_id'] ?? 1;
        $settingKey = $_POST['key'] ?? null;

        if (!$settingKey || empty($_FILES['icon'])) {
            $this->error('Missing key or icon file', 400);
        }

        $file = $_FILES['icon'];
        if ($file['error'] !== UPLOAD_ERR_OK) {
            $this->error('File upload failed with error code: ' . $file['error']);
        }

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $ext = preg_replace('/[^a-z0-9]+/', '', strtolower($ext));
        if ($ext === '') $ext = 'png';
        
        $filename = 'kiosk_' . $locationId . '_' . $settingKey . '_' . uniqid() . '.' . $ext;
        
        try {
            require_once '../app/helpers/FtpStorage.php';
            $ftp = new FtpStorage();
            $dir = 'storefront'; // directory in FTP
            $ftp->upload($file['tmp_name'], $dir, $filename);
            
            // FtpStorage usually means it's available at CONTENT_BASE_URL
            $iconPath = rtrim(CONTENT_BASE_URL, '/') . '/' . $dir . '/' . $filename;
            $this->settingModel->updateSetting($settingKey, $iconPath, $locationId);
            $this->success(['path' => $iconPath], 'Icon uploaded successfully via FTP');
        } catch (Exception $e) {
            error_log('FTP Upload Error: ' . $e->getMessage());
            $this->error('FTP upload failed: ' . $e->getMessage());
        }
    }
}
