<?php
/**
 * VehicleModel Model
 */
class VehicleModel extends Model {
    private $table = 'vehicle_models';

    public function getAll($makeId = null) {
        $sql = "SELECT vm.id, vm.make_id, m.name AS make_name, vm.name, vm.created_at
                FROM {$this->table} vm
                INNER JOIN vehicle_makes m ON m.id = vm.make_id";
        if ($makeId) {
            $sql .= " WHERE vm.make_id = :make_id";
        }
        $sql .= " ORDER BY m.name ASC, vm.name ASC";

        $this->db->query($sql);
        if ($makeId) {
            $this->db->bind(':make_id', $makeId);
        }
        return $this->db->resultSet();
    }

    public function create($data, $userId = null) {
        $this->db->query("INSERT INTO {$this->table} (make_id, name, created_by, updated_by) VALUES (:make_id, :name, :created_by, :updated_by)");
        $this->db->bind(':make_id', $data['make_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);
        return $this->db->execute();
    }

    public function update($id, $data, $userId = null) {
        $this->db->query("UPDATE {$this->table} SET make_id = :make_id, name = :name, updated_by = :updated_by WHERE id = :id");
        $this->db->bind(':make_id', $data['make_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
