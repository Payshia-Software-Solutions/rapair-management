<?php
namespace App\Core;

class Config {
    // Database Config
    const DB_HOST = 'localhost';
    const DB_USER = 'root';
    const DB_PASS = '';
    const DB_NAME = 'saas_master_db';

    // Email Config (SMTP)
    const SMTP_HOST = 'mail.payshia.com';
    const SMTP_PORT = 465;
    const SMTP_USER = 'no-reply@payshia.com';
    const SMTP_PASS = 'ty8iCkC!NN;q?RaY';
    const SMTP_FROM_NAME = 'Nexus ERP Security';
    const SMTP_FROM_EMAIL = 'no-reply@payshia.com';

    // App Config
    const SITE_URL = 'http://localhost/rapair-management/nexus-portal-ui';
    const API_URL = 'http://localhost/rapair-management/nexus-portal-server/public';
}
