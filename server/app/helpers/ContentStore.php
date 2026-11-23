<?php
/**
 * ContentStore
 * Where uploaded files go. Production keeps the app server light: files go to the content (FTP)
 * server, under <CONTENT_BASE_URL>/<kind>/ (per workspace on the shared deployment, see FtpStorage).
 *
 * Without FTP configured, a single-client/dev install keeps files under public/uploads as before.
 * The shared deployment never does that: it refuses the upload instead of filling the app server.
 */
class ContentStore {
    public static function ftpConfigured() {
        return defined('FTP_HOST') && FTP_HOST && defined('FTP_PASS') && FTP_PASS;
    }

    /**
     * Stores an uploaded temp file as $kind/$filename and returns the value to save in the database:
     * the full URL when it went to the content server, or a path relative to the API root (local).
     * Throws Exception with a message that is safe to show.
     */
    public static function save($tmpPath, $kind, $filename) {
        $filename = basename($filename);
        if (self::ftpConfigured()) {
            require_once __DIR__ . '/FtpStorage.php';
            try {
                (new FtpStorage())->upload($tmpPath, $kind, $filename);
            } catch (Throwable $e) {
                error_log('ContentStore FTP upload failed: ' . $e->getMessage());
                throw new Exception('The file could not be saved. Please try again.');
            }
            return rtrim(CONTENT_BASE_URL, '/') . '/' . trim($kind, '/') . '/' . $filename;
        }

        // No content server: keep it on this server. On the shared deployment each workspace has its
        // own folder (public/uploads/t/<slug>/...); deploys leave public/uploads alone.
        [$dir, $rel] = class_exists('Tenancy', false)
            ? Tenancy::uploadDir($kind)
            : [__DIR__ . '/../../public/uploads/' . $kind, 'uploads/' . $kind];
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) throw new Exception('Could not create the uploads folder.');
        if (!@move_uploaded_file($tmpPath, $dir . '/' . $filename)) throw new Exception('Could not save the file.');
        // Full URL: the web app resolves bare names against the content server, which doesn't have this file
        if (PHP_SAPI === 'cli' || empty($_SERVER['HTTP_HOST'])) return $rel . '/' . $filename;
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
        return ($https ? 'https' : 'http') . '://' . $_SERVER['HTTP_HOST'] . $base . '/' . $rel . '/' . $filename;
    }
}
