<?php
/**
 * DistrictController
 * Admin management for districts and their zone assignments.
 */
class DistrictController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /**
     * GET /api/district/index
     */
    public function index() {
        $this->db->query("
            SELECT d.*, z.name as zone_name 
            FROM districts d 
            LEFT JOIN shipping_zones z ON d.shipping_zone_id = z.id 
            ORDER BY d.name ASC
        ");
        $rows = $this->db->resultSet();
        $this->success($rows);
    }

    /**
     * POST /api/district/store
     */
    public function store() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            $this->error('District name is required', 400);
        }

        $this->db->query("INSERT INTO districts (name, shipping_zone_id) VALUES (:name, :zone_id)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':zone_id', $data['shipping_zone_id'] ?? null);

        if ($this->db->execute()) {
            $this->success(['id' => $this->db->lastInsertId()], 'District created');
        } else {
            $this->error('Failed to create district');
        }
    }

    /**
     * POST /api/district/update/{id}
     */
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $this->db->query("UPDATE districts SET name = :name, shipping_zone_id = :zone_id WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':zone_id', $data['shipping_zone_id'] ?? null);
        $this->db->bind(':id', $id);

        if ($this->db->execute()) {
            $this->success(null, 'District updated');
        } else {
            $this->error('Failed to update district');
        }
    }

    /**
     * POST /api/district/delete/{id}
     */
    public function delete($id) {
        $this->db->query("DELETE FROM districts WHERE id = :id");
        $this->db->bind(':id', $id);
        
        if ($this->db->execute()) {
            $this->success(null, 'District deleted');
        } else {
            $this->error('Failed to delete district');
        }
    }
}
