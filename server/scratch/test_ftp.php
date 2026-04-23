<?php
require_once 'config/config.php';
require_once 'app/helpers/FtpStorage.php';

try {
    echo "Testing FTP Connection...\n";
    echo "Host: " . FTP_HOST . "\n";
    echo "User: " . FTP_USER . "\n";
    
    $ftp = new FtpStorage();
    // Try to ensure a dummy dir
    //$ftp->ensureDir('employees_test'); // This is private in FtpStorage, we'll test via upload
    
    // Create a dummy temp file
    $tempFile = tempnam(sys_get_temp_dir(), 'ftp_test');
    file_put_contents($tempFile, "Hello FTP at " . date('Y-m-d H:i:s'));
    
    echo "Uploading test file...\n";
    $result = $ftp->upload($tempFile, 'employees', 'test_connectivity.txt');
    
    echo "Upload Success! Path: " . $result . "\n";
    echo "Resolved URL: " . rtrim(CONTENT_BASE_URL, '/') . '/employees/test_connectivity.txt' . "\n";
    
    @unlink($tempFile);
} catch (Exception $e) {
    echo "FTP Error: " . $e->getMessage() . "\n";
}
