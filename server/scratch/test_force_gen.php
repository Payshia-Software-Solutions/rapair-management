<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Model.php';
require_once 'server/app/helpers/DocumentSequenceHelper.php';
require_once 'server/app/models/RecurringInvoice.php';
require_once 'server/app/models/Invoice.php';
require_once 'server/app/helpers/EmailHelper.php';
require_once 'server/app/helpers/PdfHelper.php';
require_once 'server/app/helpers/SystemSchema.php';
require_once 'server/app/models/SystemSetting.php';

// Mocking required things
if (!defined('DB_HOST')) define('DB_HOST', 'localhost');
if (!defined('DB_NAME')) define('DB_NAME', 'repair_management_db');
if (!defined('DB_USER')) define('DB_USER', 'root');
if (!defined('DB_PASS')) define('DB_PASS', '');

try {
    $model = new RecurringInvoice();
    // Get the first active template
    $db = new Database();
    $db->query("SELECT id FROM recurring_invoices WHERE status = 'Active' LIMIT 1");
    $template = $db->single();
    
    if (!$template) {
        die("No active templates found.\n");
    }
    
    echo "Force generating for template ID: " . $template->id . "\n";
    $result = $model->forceGenerate($template->id, 1);
    
    if ($result) {
        echo "Success! Invoice ID: " . $result . "\n";
    } else {
        echo "Failed to generate.\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
