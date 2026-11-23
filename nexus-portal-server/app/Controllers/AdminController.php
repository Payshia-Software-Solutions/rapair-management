<?php
namespace App\Controllers;

use App\Core\Controller;
use App\Models\RequestModel;
use App\Models\AdminModel;

class AdminController extends Controller {
    public function __construct($route_params) {
        parent::__construct($route_params);
        $this->checkAuth();
    }

    private function checkAuth() {
        if (($_SESSION['admin_role'] ?? '') !== 'super_admin') {
            $this->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }
    }

    public function listRequests() {
        $model = new RequestModel();
        return $this->json(['status' => 'success', 'data' => $model->getAll()]);
    }

    public function updateStatus() {
        $data = $this->getPostData();
        $id = $data['id'] ?? 0;
        $status = $data['status'] ?? '';

        if (!$id || !$status) {
            return $this->json(['status' => 'error', 'message' => 'ID and Status required'], 400);
        }

        $model = new RequestModel();
        if ($model->updateStatus($id, $status)) {
            return $this->json(['status' => 'success', 'message' => 'Status updated']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Update failed'], 500);
        }
    }

    public function listUsers() {
        $model = new AdminModel();
        $rows = $model->getAll();
        $supers = count(array_filter($rows, fn($r) => $r->role === 'super_admin'));
        foreach ($rows as $r) {
            [$ok, $why] = self::canDelete($r, $supers);
            $r->deletable = $ok;
            $r->delete_blocked_reason = $ok ? null : $why;
        }
        return $this->json(['status' => 'success', 'data' => $rows]);
    }

    /**
     * An account can be deleted when it is not linked to a live tenant (no tenant, or the tenant was
     * deleted / no longer exists). Never your own account, never the last super admin.
     */
    private static function canDelete($r, int $superCount): array {
        if ((int)$r->id === (int)($_SESSION['admin_id'] ?? 0)) return [false, 'This is your own account.'];
        if ($r->role === 'super_admin' && $superCount <= 1) return [false, 'The last super admin cannot be deleted.'];
        $linked = $r->tenant_id && $r->tenant_name !== null && ($r->tenant_status ?? '') !== 'Deleted';
        if ($linked) return [false, 'Linked to tenant "' . $r->tenant_name . '". Delete the tenant first.'];
        return [true, null];
    }

    // POST /api/admin/users/delete {id}
    public function deleteUser() {
        $id = (int)(($this->getPostData() ?: [])['id'] ?? 0);
        $model = new AdminModel();
        $rows = $model->getAll();
        $row = null;
        foreach ($rows as $r) if ((int)$r->id === $id) $row = $r;
        if (!$row) return $this->json(['status' => 'error', 'message' => 'Account not found'], 404);
        $supers = count(array_filter($rows, fn($r) => $r->role === 'super_admin'));
        [$ok, $why] = self::canDelete($row, $supers);
        if (!$ok) return $this->json(['status' => 'error', 'message' => $why], 409);

        $db = new \App\Core\Database();
        $db->query("DELETE FROM portal_admins WHERE id = :id");
        $db->bind(':id', $id);
        $db->execute();
        return $this->json(['status' => 'success', 'message' => 'Account deleted']);
    }

    public function createUser() {
        $data = $this->getPostData();
        if (empty($data['username']) || empty($data['password'])) {
            return $this->json(['status' => 'error', 'message' => 'Username and Password required'], 400);
        }

        $model = new AdminModel();
        if ($model->create($data)) {
            return $this->json(['status' => 'success', 'message' => 'Admin user created']);
        } else {
            return $this->json(['status' => 'error', 'message' => 'Creation failed'], 500);
        }
    }
}
