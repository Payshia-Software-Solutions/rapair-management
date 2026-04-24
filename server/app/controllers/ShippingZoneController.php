<?php
/**
 * ShippingZoneController
 * Admin management for regional shipping rates.
 */
class ShippingZoneController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /**
     * GET /api/shippingzone/index
     */
    public function index() {
        $this->db->query("SELECT * FROM shipping_zones ORDER BY name ASC");
        $zones = $this->db->resultSet();
        $this->success($zones);
    }

    /**
     * POST /api/shippingzone/store
     */
    public function store() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name'])) {
            $this->error('Zone name is required', 400);
        }

        $this->db->query("
            INSERT INTO shipping_zones (name, base_fee, free_threshold, is_active) 
            VALUES (:name, :fee, :threshold, :active)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':fee', $data['base_fee'] ?? 0);
        $this->db->bind(':threshold', $data['free_threshold'] ?? null);
        $this->db->bind(':active', isset($data['is_active']) ? (int)$data['is_active'] : 1);

        if ($this->db->execute()) {
            $this->success(['id' => $this->db->lastInsertId()], 'Shipping zone created');
        } else {
            $this->error('Failed to create shipping zone');
        }
    }

    /**
     * POST /api/shippingzone/update/{id}
     */
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $this->db->query("
            UPDATE shipping_zones 
            SET name = :name, 
                base_fee = :fee, 
                free_threshold = :threshold, 
                is_active = :active 
            WHERE id = :id
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':fee', $data['base_fee']);
        $this->db->bind(':threshold', $data['free_threshold']);
        $this->db->bind(':active', (int)$data['is_active']);
        $this->db->bind(':id', $id);

        if ($this->db->execute()) {
            $this->success(null, 'Shipping zone updated');
        } else {
            $this->error('Failed to update shipping zone');
        }
    }

    /**
     * POST /api/shippingzone/delete/{id}
     */
    public function delete($id) {
        $this->db->query("DELETE FROM shipping_zones WHERE id = :id");
        $this->db->bind(':id', $id);
        
        if ($this->db->execute()) {
            $this->success(null, 'Shipping zone deleted');
        } else {
            $this->error('Failed to delete shipping zone');
        }
    }
}
