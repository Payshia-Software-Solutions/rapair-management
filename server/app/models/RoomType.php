<?php
/**
 * RoomType Model
 */
class RoomType extends Model {
    private $table = 'hotel_room_types';

    public function getAll() {
        $this->db->query("SELECT * FROM {$this->table} ORDER BY name ASC");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO {$this->table} (name, item_id, description, base_rate, max_occupancy)
            VALUES (:name, :item_id, :description, :rate, :max)
        ");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':item_id', $data['item_id'] ?? null);
        $this->db->bind(':description', $data['description'] ?? null);
        $this->db->bind(':rate', $data['base_rate']);
        $this->db->bind(':max', $data['max_occupancy']);
        return $this->db->execute();
    }

    public function update($id, $data) {
        $this->db->query("
            UPDATE {$this->table}
            SET name = :name, item_id = :item_id, description = :description, base_rate = :rate, max_occupancy = :max
            WHERE id = :id
        ");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':item_id', $data['item_id'] ?? null);
        $this->db->bind(':description', $data['description'] ?? null);
        $this->db->bind(':rate', $data['base_rate']);
        $this->db->bind(':max', $data['max_occupancy']);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
    
    public function getRates($id) {
        $this->db->query("SELECT * FROM hotel_room_rates WHERE type_id = :id");
        $this->db->bind(':id', $id);
        return $this->db->resultSet();
    }

    public function saveRates($id, $rates) {
        // Simple approach: Delete existing and insert new
        $this->db->query("DELETE FROM hotel_room_rates WHERE type_id = :id");
        $this->db->bind(':id', $id);
        $this->db->execute();

        foreach ($rates as $plan => $rate) {
            $this->db->query("INSERT INTO hotel_room_rates (type_id, meal_plan, rate) VALUES (:id, :plan, :rate)");
            $this->db->bind(':id', $id);
            $this->db->bind(':plan', $plan);
            $this->db->bind(':rate', (float)$rate);
            $this->db->execute();
        }
        return true;
    }
}
