<?php

class BanquetMenu {
    private $db;

    public function __construct() {
        $this->db = new Database();
    }

    public function getAll($activeOnly = false) {
        $sql = "SELECT * FROM banquet_menus";
        if ($activeOnly) {
            $sql .= " WHERE is_active = 1";
        }
        $sql .= " ORDER BY name ASC";
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM banquet_menus WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function create($data) {
        $this->db->beginTransaction();
        try {
            $this->db->query("INSERT INTO banquet_menus (name, description, price_per_pax, cost_price, is_active) 
                              VALUES (:name, :description, :price_per_pax, :cost_price, :is_active)");
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':description', $data['description'] ?? '');
            $this->db->bind(':price_per_pax', $data['price_per_pax']);
            $this->db->bind(':cost_price', $data['cost_price'] ?? 0);
            $this->db->bind(':is_active', $data['is_active'] ?? 1);
            
            if (!$this->db->execute()) throw new Exception('Menu creation failed');
            $menuId = $this->db->lastInsertId();

            if (!empty($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $item) {
                    $this->db->query("INSERT INTO banquet_menu_items (menu_id, part_id, name, category, qty, description) 
                                      VALUES (:menu_id, :part_id, :name, :category, :qty, :description)");
                    $this->db->bind(':menu_id', $menuId);
                    $this->db->bind(':part_id', $item['part_id'] ?? null);
                    $this->db->bind(':name', $item['name']);
                    $this->db->bind(':category', $item['category']);
                    $this->db->bind(':qty', $item['qty'] ?? 1);
                    $this->db->bind(':description', $item['description'] ?? '');
                    $this->db->execute();
                }
            }

            $this->db->commit();
            return $menuId;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function update($id, $data) {
        $this->db->beginTransaction();
        try {
            $this->db->query("UPDATE banquet_menus SET 
                              name = :name, 
                              description = :description, 
                              price_per_pax = :price_per_pax, 
                              cost_price = :cost_price,
                              is_active = :is_active 
                              WHERE id = :id");
            $this->db->bind(':id', $id);
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':description', $data['description'] ?? '');
            $this->db->bind(':price_per_pax', $data['price_per_pax']);
            $this->db->bind(':cost_price', $data['cost_price'] ?? 0);
            $this->db->bind(':is_active', $data['is_active'] ?? 1);
            $this->db->execute();

            // Sync Items: Delete and Re-insert (simplest for full list sync)
            $this->db->query("DELETE FROM banquet_menu_items WHERE menu_id = :id");
            $this->db->bind(':id', $id);
            $this->db->execute();

            if (!empty($data['items']) && is_array($data['items'])) {
                foreach ($data['items'] as $item) {
                    $this->db->query("INSERT INTO banquet_menu_items (menu_id, part_id, name, category, qty, description) 
                                      VALUES (:menu_id, :part_id, :name, :category, :qty, :description)");
                    $this->db->bind(':menu_id', $id);
                    $this->db->bind(':part_id', $item['part_id'] ?? null);
                    $this->db->bind(':name', $item['name']);
                    $this->db->bind(':category', $item['category']);
                    $this->db->bind(':qty', $item['qty'] ?? 1);
                    $this->db->bind(':description', $item['description'] ?? '');
                    $this->db->execute();
                }
            }

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function delete($id) {
        $this->db->query("DELETE FROM banquet_menus WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getItems($menuId) {
        $this->db->query("
            SELECT i.*, p.part_name, p.cost_price as unit_cost
            FROM banquet_menu_items i
            LEFT JOIN parts p ON i.part_id = p.id
            WHERE i.menu_id = :menu_id 
            ORDER BY i.category, i.name ASC
        ");
        $this->db->bind(':menu_id', $menuId);
        return $this->db->resultSet();
    }

    public function addItem($data) {
        $this->db->query("INSERT INTO banquet_menu_items (menu_id, part_id, name, category, qty, description) 
                          VALUES (:menu_id, :part_id, :name, :category, :qty, :description)");
        $this->db->bind(':menu_id', $data['menu_id']);
        $this->db->bind(':part_id', $data['part_id'] ?? null);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':category', $data['category']);
        $this->db->bind(':qty', $data['qty'] ?? 1);
        $this->db->bind(':description', $data['description'] ?? '');
        return $this->db->execute();
    }

    public function removeItem($id) {
        $this->db->query("DELETE FROM banquet_menu_items WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
