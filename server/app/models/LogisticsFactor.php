<?php
/**
 * Logistics Factor Model
 */
class LogisticsFactor extends Model {
    private $table = 'logistics_factors';

    public function list($activeOnly = true) {
        $sql = "SELECT f.*, GROUP_CONCAT(tfd.shipping_term) as default_terms 
                FROM {$this->table} f
                LEFT JOIN term_factor_defaults tfd ON tfd.factor_id = f.id";
        
        $sql .= $activeOnly ? " WHERE f.is_active = 1" : "";
        $sql .= " GROUP BY f.id ORDER BY f.name ASC";
        
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->beginTransaction();
        try {
            $this->db->query("
                INSERT INTO {$this->table} (name, type, absorption_method, is_active)
                VALUES (:name, :type, :method, :is_active)
            ");
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':type', $data['type'] ?? 'General');
            $this->db->bind(':method', $data['absorption_method'] ?? 'Value');
            $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
            $this->db->execute();
            $id = $this->db->lastInsertId();

            if (!empty($data['default_terms']) && is_array($data['default_terms'])) {
                foreach ($data['default_terms'] as $term) {
                    $this->db->query("INSERT INTO term_factor_defaults (shipping_term, factor_id) VALUES (:term, :fid)");
                    $this->db->bind(':term', $term);
                    $this->db->bind(':fid', $id);
                    $this->db->execute();
                }
            }

            $this->db->commit();
            return $id;
        } catch (Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }

    public function update($id, $data) {
        $this->db->beginTransaction();
        try {
            $this->db->query("
                UPDATE {$this->table}
                SET name = :name, type = :type, absorption_method = :method, is_active = :is_active
                WHERE id = :id
            ");
            $this->db->bind(':name', $data['name']);
            $this->db->bind(':type', $data['type'] ?? 'General');
            $this->db->bind(':method', $data['absorption_method'] ?? 'Value');
            $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
            $this->db->bind(':id', $id);
            $this->db->execute();

            // Update terms
            $this->db->query("DELETE FROM term_factor_defaults WHERE factor_id = :id");
            $this->db->bind(':id', $id);
            $this->db->execute();

            if (!empty($data['default_terms']) && is_array($data['default_terms'])) {
                foreach ($data['default_terms'] as $term) {
                    $this->db->query("INSERT INTO term_factor_defaults (shipping_term, factor_id) VALUES (:term, :fid)");
                    $this->db->bind(':term', $term);
                    $this->db->bind(':fid', $id);
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
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getTermDefaults($term) {
        $this->db->query("
            SELECT f.* 
            FROM {$this->table} f
            INNER JOIN term_factor_defaults tfd ON tfd.factor_id = f.id
            WHERE tfd.shipping_term = :term
        ");
        $this->db->bind(':term', $term);
        return $this->db->resultSet();
    }
}
