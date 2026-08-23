<?php
/**
 * ShippingCarrierController
 */
class ShippingCarrierController extends Controller {
    public function __construct() {
        $this->carrierModel = $this->model('ShippingCarrier');
    }

    public function index() {
        $this->requirePermission('locations.read');
        $carriers = $this->carrierModel->getAll();
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'success',
            'data' => $carriers
        ]);
    }

    public function show($id) {
        $this->requirePermission('locations.read');
        $carrier = $this->carrierModel->getById($id);
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'success',
            'data' => $carrier
        ]);
    }

    public function store() {
        $this->requirePermission('locations.write');
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Carrier name is required']);
            return;
        }

        if ($this->carrierModel->create($data)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Failed to create carrier']);
        }
    }

    public function update($id) {
        $this->requirePermission('locations.write');
        $data = json_decode(file_get_contents('php://input'), true);
        if (empty($data['name'])) {
            http_response_code(400);
            echo json_encode(['message' => 'Carrier name is required']);
            return;
        }

        if ($this->carrierModel->update($id, $data)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Failed to update carrier']);
        }
    }

    public function delete($id) {
        $this->requirePermission('locations.write');
        if ($this->carrierModel->delete($id)) {
            echo json_encode(['success' => true]);
        } else {
            http_response_code(500);
            echo json_encode(['message' => 'Failed to delete carrier']);
        }
    }
}
