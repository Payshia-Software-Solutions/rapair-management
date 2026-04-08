<?php
/**
 * Configuration for the Repair Management Backend
 */

// App Constants
define('APPROOT', dirname(dirname(__FILE__)));
define('URLROOT', 'http://localhost/rapair-management/server');
define('SITENAME', 'Repair Management API');

// Database Parameters
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'repair_management_db');

// JWT Configuration
// Change this in production.
define('JWT_SECRET', 'change_me_dev_secret');
define('JWT_ISSUER', 'repair-management');
define('JWT_TTL_SECONDS', 60 * 60 * 8); // 8 hours

// FTP/FTPS Storage (for images & attachments)
// Prefer environment variables in production.
define('FTP_HOST', getenv('FTP_HOST') ?: 'ftp.payshia.com');
define('FTP_PORT', (int)(getenv('FTP_PORT') ?: 21));
define('FTP_USER', getenv('FTP_USER') ?: 'service-center-system@payshia.com');
define('FTP_PASS', getenv('FTP_PASS') ?: '4pxRF9{.QK],9$SB'); // set via env in production
define('CONTENT_BASE_URL', getenv('CONTENT_BASE_URL') ?: 'https://content-provider.payshia.com/service-center-system/');
define('CONTENT_VEHICLES_DIR', getenv('CONTENT_VEHICLES_DIR') ?: 'vehicles');
define('CONTENT_ORDERS_DIR', getenv('CONTENT_ORDERS_DIR') ?: 'orders');

// Autoloading Configuration (PSR-4)
// This will be handled in index.php for simplicity or through a helper.
