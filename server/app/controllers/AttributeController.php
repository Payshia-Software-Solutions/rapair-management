<?php
/**
 * AttributeController - Product custom attributes and groups
 */
class AttributeController extends Controller {
    private $model;

    public function __construct() {
        require_once '../app/models/PartAttribute.php';
        $this->model = new PartAttribute();
    }

    // --- Groups ---

    public function list_groups() {
        $this->requirePermission('parts.read');
        $rows = $this->model->listGroups();
        $this->success($rows);
    }

    public function create_group() {
        $this->requirePermission('parts.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) $this->error('Name required', 400);
        
        $id = $this->model->createGroup($data);
        if ($id) $this->success(['id' => $id]);
        $this->error('Failed to create group');
    }

    public function update_group($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name'])) $this->error('Name required', 400);
        
        if ($this->model->updateGroup($id, $data)) $this->success();
        $this->error('Failed to update group');
    }

    public function delete_group($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        if ($this->model->deleteGroup($id)) $this->success();
        $this->error('Failed to delete group');
    }

    // --- Attributes ---

    public function list($groupId = null) {
        $this->requirePermission('parts.read');
        $rows = $this->model->listAttributes($groupId);
        $this->success($rows);
    }

    public function create() {
        $this->requirePermission('parts.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name']) || empty($data['group_id'])) $this->error('Missing required fields', 400);
        
        $id = $this->model->createAttribute($data);
        if ($id) $this->success(['id' => $id]);
        $this->error('Failed to create attribute');
    }

    public function update($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['name']) || empty($data['group_id'])) $this->error('Missing required fields', 400);
        
        if ($this->model->updateAttribute($id, $data)) $this->success();
        $this->error('Failed to update attribute');
    }

    public function delete($id = null) {
        $this->requirePermission('parts.write');
        if (!$id) $this->error('ID required', 400);
        if ($this->model->deleteAttribute($id)) $this->success();
        $this->error('Failed to delete attribute');
    }

    // --- Part Assignments ---

    public function assign_to_part() {
        $this->requirePermission('parts.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['part_id']) || empty($data['group_id'])) $this->error('Missing fields', 400);
        
        if ($this->model->assignGroupToPart($data['part_id'], $data['group_id'])) $this->success();
        $this->error('Failed to assign group');
    }

    public function unassign_from_part() {
        $this->requirePermission('parts.write');
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        if (empty($data['part_id']) || empty($data['group_id'])) $this->error('Missing fields', 400);
        
        if ($this->model->unassignGroupFromPart($data['part_id'], $data['group_id'])) $this->success();
        $this->error('Failed to unassign group');
    }
}
