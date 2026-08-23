<?php
/**
 * CityController
 * Management for cities within districts.
 */
class CityController extends Controller {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    /**
     * GET /api/city/index
     * Optional district_id filter
     */
    public function index() {
        $this->requirePermission('locations.read');
        $districtId = isset($_GET['district_id']) ? (int)$_GET['district_id'] : null;

        if ($districtId > 0) {
            $this->db->query("SELECT * FROM cities WHERE district_id = :did ORDER BY name ASC");
            $this->db->bind(':did', $districtId);
        } else {
            $this->db->query("SELECT c.*, d.name as district_name FROM cities c LEFT JOIN districts d ON c.district_id = d.id ORDER BY c.name ASC");
        }
        $cities = $this->db->resultSet();
        $this->success($cities);
    }

    /**
     * POST /api/city/store
     */
    public function store() {
        $this->requirePermission('locations.write');
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->error('Method Not Allowed', 405);
        }

        $data = json_decode(file_get_contents('php://input'), true);
        
        if (empty($data['name']) || empty($data['district_id'])) {
            $this->error('Name and district_id are required', 400);
        }

        $this->db->query("INSERT INTO cities (name, district_id) VALUES (:name, :did)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':did', $data['district_id']);

        if ($this->db->execute()) {
            $this->success(['id' => $this->db->lastInsertId()], 'City created');
        } else {
            $this->error('Failed to create city');
        }
    }

    /**
     * POST /api/city/update/{id}
     */
    public function update($id) {
        $this->requirePermission('locations.write');
        $data = json_decode(file_get_contents('php://input'), true);
        
        $this->db->query("UPDATE cities SET name = :name, district_id = :did WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':did', $data['district_id']);
        $this->db->bind(':id', $id);

        if ($this->db->execute()) {
            $this->success(null, 'City updated');
        } else {
            $this->error('Failed to update city');
        }
    }

    /**
     * POST /api/city/delete/{id}
     */
    public function delete($id) {
        $this->requirePermission('locations.write');
        $this->db->query("DELETE FROM cities WHERE id = :id");
        $this->db->bind(':id', $id);
        
        if ($this->db->execute()) {
            $this->success(null, 'City deleted');
        } else {
            $this->error('Failed to delete city');
        }
    }
}
