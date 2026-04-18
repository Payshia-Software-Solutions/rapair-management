<?php
/**
 * RestaurantTableController
 */
class RestaurantTableController extends Controller {
    private $tableModel;

    public function __construct() {
        $this->tableModel = $this->model('RestaurantTable');
    }

    public function list() {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') $this->error('Method Not Allowed', 405);
        
        $locationId = $this->currentLocationId($u);
        $tables = $this->tableModel->list($locationId);
        $this->success($tables);
    }

    public function create() {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['location_id'])) {
            $data['location_id'] = $this->currentLocationId($u);
        }
        
        if (empty($data['name'])) $this->error('Table name required', 400);

        if ($this->tableModel->create($data)) {
            $this->success(null, 'Table created successfully');
        }
        $this->error('Failed to create table');
    }

    public function update($id = null) {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Table ID required', 400);

        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) $this->error('Table name required', 400);
        // Default to current loc if none provided during update (usually stays same)
        if (empty($data['location_id'])) {
            $existing = $this->tableModel->getById($id);
            $data['location_id'] = $existing['location_id'] ?? $this->currentLocationId($u);
        }

        if ($this->tableModel->update($id, $data)) {
            $this->success(null, 'Table updated successfully');
        }
        $this->error('Failed to update table');
    }

    public function delete($id = null) {
        $u = $this->requireAuth();
        if ($_SERVER['REQUEST_METHOD'] !== 'DELETE') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Table ID required', 400);

        if ($this->tableModel->delete($id)) {
            $this->success(null, 'Table deleted successfully');
        }
        $this->error('Failed to delete table');
    }
}
