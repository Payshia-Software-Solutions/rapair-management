<?php
class ShippingPackingModel {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    // Packaging Types
    public function getPackaging() {
        $this->db->query("SELECT * FROM export_packaging_types WHERE is_active = 1 ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function createPackaging($data) {
        $this->db->query("INSERT INTO export_packaging_types (name, type, length_cm, width_cm, height_cm, cbm, tare_weight_kg, max_weight_capacity_kg) VALUES (:name, :type, :length, :width, :height, :cbm, :tare, :max)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':type', $data['type'] ?? 'Carton');
        $this->db->bind(':length', $data['length_cm'] ?? 0);
        $this->db->bind(':width', $data['width_cm'] ?? 0);
        $this->db->bind(':height', $data['height_cm'] ?? 0);
        $this->db->bind(':cbm', $data['cbm'] ?? 0);
        $this->db->bind(':tare', $data['tare_weight_kg'] ?? 0);
        $this->db->bind(':max', $data['max_weight_capacity_kg'] ?? 0);
        $this->db->execute();
        return $this->db->lastInsertId();
    }

    public function deletePackaging($id) {
        $this->db->query("DELETE FROM export_packaging_types WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function updatePackaging($id, $data) {
        $this->db->query("UPDATE export_packaging_types SET name = :name, type = :type, length_cm = :length, width_cm = :width, height_cm = :height, cbm = :cbm, tare_weight_kg = :tare, max_weight_capacity_kg = :max WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':type', $data['type'] ?? 'Carton');
        $this->db->bind(':length', $data['length_cm'] ?? 0);
        $this->db->bind(':width', $data['width_cm'] ?? 0);
        $this->db->bind(':height', $data['height_cm'] ?? 0);
        $this->db->bind(':cbm', $data['cbm'] ?? 0);
        $this->db->bind(':tare', $data['tare_weight_kg'] ?? 0);
        $this->db->bind(':max', $data['max_weight_capacity_kg'] ?? 0);
        return $this->db->execute();
    }

    // Pallet Types
    public function getPallets() {
        $this->db->query("SELECT * FROM export_pallet_types WHERE is_active = 1 ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function createPallet($data) {
        $this->db->query("INSERT INTO export_pallet_types (name, length_cm, width_cm, max_load_height_cm, tare_weight_kg, max_weight_capacity_kg) VALUES (:name, :length, :width, :max_height, :tare, :max)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':length', $data['length_cm'] ?? 0);
        $this->db->bind(':width', $data['width_cm'] ?? 0);
        $this->db->bind(':max_height', $data['max_load_height_cm'] ?? 0);
        $this->db->bind(':tare', $data['tare_weight_kg'] ?? 0);
        $this->db->bind(':max', $data['max_weight_capacity_kg'] ?? 0);
        $this->db->execute();
        return $this->db->lastInsertId();
    }

    public function deletePallet($id) {
        $this->db->query("DELETE FROM export_pallet_types WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function updatePallet($id, $data) {
        $this->db->query("UPDATE export_pallet_types SET name = :name, length_cm = :length, width_cm = :width, max_load_height_cm = :max_height, tare_weight_kg = :tare, max_weight_capacity_kg = :max WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':length', $data['length_cm'] ?? 0);
        $this->db->bind(':width', $data['width_cm'] ?? 0);
        $this->db->bind(':max_height', $data['max_load_height_cm'] ?? 0);
        $this->db->bind(':tare', $data['tare_weight_kg'] ?? 0);
        $this->db->bind(':max', $data['max_weight_capacity_kg'] ?? 0);
        return $this->db->execute();
    }

    // Container Types
    public function getContainers() {
        $this->db->query("SELECT * FROM export_container_types WHERE is_active = 1 ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function createContainer($data) {
        $this->db->query("INSERT INTO export_container_types (name, max_cbm_capacity, max_weight_capacity_kg, max_standard_pallets) VALUES (:name, :cbm, :max_weight, :max_pallets)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':cbm', $data['max_cbm_capacity'] ?? 0);
        $this->db->bind(':max_weight', $data['max_weight_capacity_kg'] ?? 0);
        $this->db->bind(':max_pallets', $data['max_standard_pallets'] ?? 0);
        $this->db->execute();
        return $this->db->lastInsertId();
    }

    public function deleteContainer($id) {
        $this->db->query("DELETE FROM export_container_types WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function updateContainer($id, $data) {
        $this->db->query("UPDATE export_container_types SET name = :name, max_cbm_capacity = :cbm, max_weight_capacity_kg = :max_weight, max_standard_pallets = :max_pallets WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':cbm', $data['max_cbm_capacity'] ?? 0);
        $this->db->bind(':max_weight', $data['max_weight_capacity_kg'] ?? 0);
        $this->db->bind(':max_pallets', $data['max_standard_pallets'] ?? 0);
        return $this->db->execute();
    }
}
