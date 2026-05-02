<?php
/**
 * Shipping Costing Template Model
 */
class ShippingCostingTemplate extends Model {
    private $table = 'shipping_costing_templates';
    private $itemsTable = 'shipping_costing_items';

    public function list($activeOnly = true) {
        $sql = "SELECT * FROM {$this->table}";
        if ($activeOnly) {
            $sql .= " WHERE is_active = 1";
        }
        $sql .= " ORDER BY name ASC";
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        $template = $this->db->single();
        
        if ($template) {
            $this->db->query("SELECT * FROM {$this->itemsTable} WHERE template_id = :id AND is_active = 1");
            $this->db->bind(':id', $id);
            $template->items = $this->db->resultSet();
        }
        
        return $template;
    }

    public function create($data, $userId = null) {
        $this->db->beginTransaction();
        try {
            $this->db->query("
                INSERT INTO {$this->table} (name, is_active, created_by, updated_by)
                VALUES (:name, :is_active, :c, :u)
            ");
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
            $this->db->bind(':c', $userId);
            $this->db->bind(':u', $userId);
            $this->db->execute();
            $templateId = $this->db->lastInsertId();

            if ($templateId && !empty($data['items'])) {
                foreach ($data['items'] as $item) {
                    $this->db->query("
                        INSERT INTO {$this->itemsTable} (template_id, name, cost_type, value)
                        VALUES (:tid, :name, :type, :val)
                    ");
                    $this->db->bind(':tid', $templateId);
                    $this->db->bind(':name', $item['name']);
                    $this->db->bind(':type', $item['cost_type'] ?? 'Fixed');
                    $this->db->bind(':val', $item['value'] ?? 0);
                    $this->db->execute();
                }
            }

            $this->db->commit();
            return $templateId;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("ShippingCostingTemplate::create error: " . $e->getMessage());
            return false;
        }
    }

    public function update($id, $data, $userId = null) {
        $this->db->beginTransaction();
        try {
            $this->db->query("
                UPDATE {$this->table}
                SET name = :name,
                    is_active = :is_active,
                    updated_by = :u
                WHERE id = :id
            ");
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
            $this->db->bind(':u', $userId);
            $this->db->bind(':id', $id);
            $this->db->execute();

            // Replace items
            $this->db->query("DELETE FROM {$this->itemsTable} WHERE template_id = :id");
            $this->db->bind(':id', $id);
            $this->db->execute();

            if (!empty($data['items'])) {
                foreach ($data['items'] as $item) {
                    $this->db->query("
                        INSERT INTO {$this->itemsTable} (template_id, name, cost_type, value)
                        VALUES (:tid, :name, :type, :val)
                    ");
                    $this->db->bind(':tid', $id);
                    $this->db->bind(':name', $item['name']);
                    $this->db->bind(':type', $item['cost_type'] ?? 'Fixed');
                    $this->db->bind(':val', $item['value'] ?? 0);
                    $this->db->execute();
                }
            }

            $this->db->commit();
            return true;
        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("ShippingCostingTemplate::update error: " . $e->getMessage());
            return false;
        }
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
