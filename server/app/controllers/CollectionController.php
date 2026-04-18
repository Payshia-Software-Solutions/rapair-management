<?php
/**
 * Collection Controller
 * CRUD for Product Collections
 */
class CollectionController extends Controller {
    private $model;

    public function __construct() {
        $this->model = new Collection();
    }

    private function getJsonInput() {
        return json_decode(file_get_contents('php://input'), true) ?: [];
    }

    // GET /api/collection/list
    public function list() {
        $u = $this->requireAuth();
        $publicOnly = isset($_GET['public']) && $_GET['public'] === '1';
        $rows = $this->model->getAll($publicOnly);
        $this->success($rows);
    }

    // GET /api/collection/get/1
    public function get($id = null) {
        $this->requirePermission('parts.read');
        if (!$id) $this->error('ID required', 400);
        $row = $this->model->getById($id);
        if (!$row) $this->error('Collection not found', 404);
        $this->success($row);
    }

    // POST /api/collection/create
    public function create() {
        $u = $this->requirePermission('parts.write');
        $data = $this->getJsonInput();
        
        if (empty($data['name'])) {
            $this->error('Name is required', 400);
            return;
        }

        $id = $this->model->create($data, $u['sub']);
        if ($id) {
            $this->success(['id' => $id], 'Collection created successfully');
        } else {
            $this->error('Failed to create collection', 500);
        }
    }

    // POST /api/collection/update/1
    public function update($id = null) {
        $u = $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        $data = $this->getJsonInput();
        
        if (empty($data['name'])) {
            $this->error('Name is required', 400);
            return;
        }

        if ($this->model->update($id, $data, $u['sub'])) {
            $this->success(['message' => 'Collection updated successfully']);
        } else {
            $this->error('Failed to update collection', 500);
        }
    }

    // DELETE /api/collection/delete/1
    public function delete($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        if ($this->model->delete($id)) {
            $this->success(['message' => 'Collection deleted successfully']);
        } else {
            $this->error('Failed to delete collection', 500);
        }
    }

    // GET /api/collection/parts/1
    public function parts($id = null) {
        $this->requirePermission('parts.read');
        if (!$id) $this->error('ID required', 400);
        $rows = $this->model->getCollectionParts($id);
        $this->success($rows);
    }

    // POST /api/collection/sync_parts/1
    public function sync_parts($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        $data = $this->getJsonInput();
        $partIds = $data['part_ids'] ?? [];

        if ($this->model->syncCollectionParts($id, $partIds)) {
            $this->success(['message' => 'Products mapped successfully']);
        } else {
            $this->error('Failed to map products', 500);
        }
    }
}
