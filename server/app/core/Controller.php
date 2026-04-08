<?php
/**
 * Base Controller
 * Loads Models and provides utility methods for JSON responses.
 */

class Controller {
    // Load Model
    public function model($model) {
        // Require model file
        require_once '../app/models/' . $model . '.php';

        // Instantiate model
        return new $model();
    }

    // JSON Response Helper
    public function json($data, $status = 200) {
        header('Content-Type: application/json');
        http_response_code($status);
        echo json_encode($data);
        exit();
    }

    // Success JSON Response
    public function success($data = [], $message = 'Success') {
        $this->json([
            'status' => 'success',
            'message' => $message,
            'data' => $data
        ]);
    }

    // Error JSON Response
    public function error($message = 'Internal Server Error', $status = 500) {
        $this->json([
            'status' => 'error',
            'message' => $message
        ], $status);
    }

    protected function getBearerToken() {
        $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        if (!$hdr) {
            // Some servers may pass it differently.
            $hdr = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        }
        if (!$hdr) {
            // Fallbacks for Apache/XAMPP setups.
            if (function_exists('getallheaders')) {
                $headers = getallheaders();
                if (isset($headers['Authorization'])) $hdr = $headers['Authorization'];
                if (!$hdr && isset($headers['authorization'])) $hdr = $headers['authorization'];
            } elseif (function_exists('apache_request_headers')) {
                $headers = apache_request_headers();
                if (isset($headers['Authorization'])) $hdr = $headers['Authorization'];
            }
        }
        if (!$hdr) return null;
        if (stripos($hdr, 'Bearer ') !== 0) return null;
        return trim(substr($hdr, 7));
    }

    protected function currentUser() {
        $token = $this->getBearerToken();
        if (!$token) return null;
        $payload = JwtHelper::decode($token, JWT_SECRET);
        if (!$payload) return null;
        if (($payload['iss'] ?? '') !== JWT_ISSUER) return null;
        return $payload;
    }

    protected function requireAuth() {
        $u = $this->currentUser();
        if (!$u || !isset($u['sub'])) {
            $this->error('Unauthorized', 401);
        }
        return $u;
    }

    protected function requirePermission($permKey) {
        $u = $this->requireAuth();
        $role = (string)($u['role'] ?? '');
        if ($role === 'Admin') {
            return $u;
        }

        $db = new Database();
        $db->query("
            SELECT 1
            FROM roles r
            INNER JOIN role_permissions rp ON rp.role_id = r.id
            INNER JOIN permissions p ON p.id = rp.permission_id
            WHERE r.name = :role AND p.perm_key = :perm
            LIMIT 1
        ");
        $db->bind(':role', $role);
        $db->bind(':perm', $permKey);
        $row = $db->single();
        if (!$row) {
            $this->error('Forbidden', 403);
        }
        return $u;
    }
}
