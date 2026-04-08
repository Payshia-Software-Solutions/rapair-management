<?php
/**
 * Admin Controller (Admin-only operations)
 *
 * Endpoints:
 * - GET  /api/admin/users
 * - POST /api/admin/set_user_role/{id}
 */
class AdminController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    private function requireAdmin() {
        $u = $this->requireAuth();
        if (($u['role'] ?? '') !== 'Admin') {
            $this->error('Forbidden', 403);
        }
        return $u;
    }

    // GET /api/admin/users
    public function users() {
        $this->requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            $this->error('Method Not Allowed', 405);
            return;
        }

        $this->db->query("
            SELECT u.id, u.name, u.email, u.role_id, r.name AS role, u.created_at
            FROM users u
            INNER JOIN roles r ON r.id = u.role_id
            ORDER BY u.id ASC
        ");
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    // POST /api/admin/set_user_role/{id}
    public function set_user_role($id = null) {
        $this->requireAdmin();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
            return;
        }
        if (!$id) {
            $this->error('User ID required', 400);
            return;
        }

        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        $roleId = (int)($data['role_id'] ?? 0);
        if ($roleId <= 0) {
            $this->error('role_id is required', 400);
            return;
        }

        // Validate role exists.
        $this->db->query("SELECT id, name FROM roles WHERE id = :id LIMIT 1");
        $this->db->bind(':id', $roleId);
        $role = $this->db->single();
        if (!$role) {
            $this->error('Invalid role_id', 400);
            return;
        }

        // Update role_id.
        $this->db->query("UPDATE users SET role_id = :role_id WHERE id = :id");
        $this->db->bind(':role_id', $roleId);
        $this->db->bind(':id', (int)$id);
        $ok = $this->db->execute();

        if ($ok) {
            $this->success(null, 'User role updated');
        } else {
            $this->error('Failed to update user role');
        }
    }
}
