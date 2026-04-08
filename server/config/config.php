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

// Autoloading Configuration (PSR-4)
// This will be handled in index.php for simplicity or through a helper.
