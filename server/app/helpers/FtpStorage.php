<?php
/**
 * FtpStorage Helper (explicit FTPS via ftp_ssl_connect)
 * Uploads files to a remote FTP/FTPS server and creates directories if needed.
 */

class FtpStorage {
    private $conn = null;

    private function connect() {
        if ($this->conn) return $this->conn;

        if (!function_exists('ftp_ssl_connect')) {
            throw new Exception('PHP FTP SSL extension not available (ftp_ssl_connect missing)');
        }

        $host = FTP_HOST;
        $port = FTP_PORT;
        $user = FTP_USER;
        $pass = FTP_PASS;
        if (!$pass) {
            throw new Exception('FTP password not configured (FTP_PASS)');
        }

        $conn = @ftp_ssl_connect($host, $port, 20);
        if (!$conn) {
            throw new Exception('Failed to connect to FTP server');
        }
        if (!@ftp_login($conn, $user, $pass)) {
            @ftp_close($conn);
            throw new Exception('FTP login failed');
        }

        // Passive mode is usually required behind NAT / on shared hosts.
        @ftp_pasv($conn, true);

        $this->conn = $conn;
        return $conn;
    }

    private function ensureDir($path) {
        $conn = $this->connect();
        $path = trim($path);
        if ($path === '' || $path === '/' || $path === '.') return;

        $parts = array_values(array_filter(explode('/', str_replace('\\', '/', $path)), function ($p) {
            return $p !== '' && $p !== '.';
        }));
        $cwd = @ftp_pwd($conn);
        if ($cwd === false) $cwd = '/';

        // Try absolute from root.
        @ftp_chdir($conn, '/');
        foreach ($parts as $p) {
            if (!@ftp_chdir($conn, $p)) {
                // Create if missing, then enter.
                if (!@ftp_mkdir($conn, $p)) {
                    // If mkdir failed, maybe it already exists; try chdir again.
                    if (!@ftp_chdir($conn, $p)) {
                        // Restore and fail.
                        @ftp_chdir($conn, $cwd);
                        throw new Exception('Failed to create remote directory: ' . $path);
                    }
                } else {
                    @ftp_chdir($conn, $p);
                }
            }
        }

        // Restore original cwd.
        @ftp_chdir($conn, $cwd);
    }

    public function upload($localPath, $remoteDir, $remoteFilename) {
        $conn = $this->connect();
        $remoteDir = trim(str_replace('\\', '/', $remoteDir), '/');
        $remoteFilename = basename($remoteFilename);

        if (!is_string($localPath) || $localPath === '' || !file_exists($localPath)) {
            throw new Exception('Local file missing');
        }
        if ($remoteFilename === '') {
            throw new Exception('Remote filename missing');
        }

        $this->ensureDir($remoteDir);

        $remotePath = ($remoteDir !== '' ? ($remoteDir . '/') : '') . $remoteFilename;
        $ok = @ftp_put($conn, $remotePath, $localPath, FTP_BINARY);
        if (!$ok) {
            throw new Exception('FTP upload failed');
        }

        return $remotePath;
    }

    public function close() {
        if ($this->conn) {
            @ftp_close($this->conn);
            $this->conn = null;
        }
    }

    public function __destruct() {
        $this->close();
    }
}

