<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Services\SchemaService;

/**
 * Admin: the Nexus database itself.
 *
 *   GET  api/admin/system/schema-diff     what the Nexus database is missing (read-only)
 *   POST api/admin/system/schema-update   {fingerprint}  full backup, then the reviewed additions only
 */
class SystemController extends Controller {

    private function checkAuth() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }

    private function fail(\Throwable $e) {
        $bad = $e instanceof \InvalidArgumentException;
        if (!$bad) error_log('Nexus schema: ' . $e->getMessage());
        return $this->json(['status' => 'error', 'message' => $e->getMessage()], $bad ? 409 : 500);
    }

    public function schemaDiff() {
        $this->checkAuth();
        try { return $this->json(['status' => 'success', 'data' => SchemaService::diff()]); }
        catch (\Throwable $e) { return $this->fail($e); }
    }

    public function schemaUpdate() {
        $this->checkAuth();
        @set_time_limit(700);
        $fp = (string)(($this->getPostData() ?: [])['fingerprint'] ?? '');
        if (!preg_match('/^[0-9a-f]{64}$/', $fp)) return $this->json(['status' => 'error', 'message' => 'Review the changes first.'], 400);
        try { return $this->json(['status' => 'success', 'data' => SchemaService::update($fp)]); }
        catch (\Throwable $e) { return $this->fail($e); }
    }
}
