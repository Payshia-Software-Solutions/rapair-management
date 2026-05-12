<?php
/**
 * Attribute Model
 * Manages custom product attributes and their groups.
 */
class PartAttribute extends Model {
    
    public function listGroups() {
        $this->db->query("SELECT * FROM attribute_groups ORDER BY sort_order ASC, name ASC");
        return $this->db->resultSet();
    }

    public function getGroup($id) {
        $this->db->query("SELECT * FROM attribute_groups WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function listAttributes($groupId = null) {
        $sql = "SELECT a.*, g.name as group_name 
                FROM attributes a 
                JOIN attribute_groups g ON a.group_id = g.id";
        if ($groupId) {
            $sql .= " WHERE a.group_id = :gid";
        }
        $sql .= " ORDER BY g.sort_order ASC, a.sort_order ASC";
        
        $this->db->query($sql);
        if ($groupId) $this->db->bind(':gid', $groupId);
        return $this->db->resultSet();
    }

    /**
     * Get grouped attributes with values for a specific part
     */
    public function getPartAttributesGrouped($partId) {
        $this->db->query("
            SELECT g.id as group_id, g.name as group_name,
                   a.id as attribute_id, a.name as attribute_name, a.type,
                   v.value
            FROM part_attribute_groups pg
            JOIN attribute_groups g ON g.id = pg.group_id
            LEFT JOIN attributes a ON a.group_id = g.id
            LEFT JOIN part_attribute_values v ON v.attribute_id = a.id AND v.part_id = :pid
            WHERE pg.part_id = :pid
            ORDER BY g.sort_order ASC, a.sort_order ASC
        ");
        $this->db->bind(':pid', $partId);
        $rows = $this->db->resultSet();
        
        $groups = [];
        foreach ($rows as $row) {
            if (!isset($groups[$row->group_id])) {
                $groups[$row->group_id] = [
                    'id' => $row->group_id,
                    'name' => $row->group_name,
                    'attributes' => []
                ];
            }
            if ($row->attribute_id) {
                $groups[$row->group_id]['attributes'][] = [
                    'id' => $row->attribute_id,
                    'name' => $row->attribute_name,
                    'type' => $row->type,
                    'value' => $row->value
                ];
            }
        }
        return array_values($groups);
    }

    public function assignGroupToPart($partId, $groupId) {
        $this->db->query("INSERT IGNORE INTO part_attribute_groups (part_id, group_id) VALUES (:pid, :gid)");
        $this->db->bind(':pid', $partId);
        $this->db->bind(':gid', $groupId);
        return $this->db->execute();
    }

    public function unassignGroupFromPart($partId, $groupId) {
        $this->db->query("DELETE FROM part_attribute_groups WHERE part_id = :pid AND group_id = :gid");
        $this->db->bind(':pid', $partId);
        $this->db->bind(':gid', $groupId);
        return $this->db->execute();
    }

    public function syncPartAttributes($partId, $values) {
        $pid = (int)$partId;
        foreach ($values as $attrId => $val) {
            $this->db->query("
                INSERT INTO part_attribute_values (part_id, attribute_id, value)
                VALUES (:pid, :aid, :val)
                ON DUPLICATE KEY UPDATE value = :val
            ");
            $this->db->bind(':pid', $pid);
            $this->db->bind(':aid', (int)$attrId);
            $this->db->bind(':val', $val);
            $this->db->execute();
        }
        return true;
    }

    public function createGroup($data) {
        $this->db->query("INSERT INTO attribute_groups (name, sort_order) VALUES (:name, :sort)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':sort', $data['sort_order'] ?? 0);
        if ($this->db->execute()) return $this->db->lastInsertId();
        return false;
    }

    public function updateGroup($id, $data) {
        $this->db->query("UPDATE attribute_groups SET name = :name, sort_order = :sort WHERE id = :id");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':sort', $data['sort_order'] ?? 0);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function deleteGroup($id) {
        $this->db->query("DELETE FROM attribute_groups WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function createAttribute($data) {
        $this->db->query("INSERT INTO attributes (group_id, name, type, sort_order) VALUES (:gid, :name, :type, :sort)");
        $this->db->bind(':gid', $data['group_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':type', $data['type'] ?? 'text');
        $this->db->bind(':sort', $data['sort_order'] ?? 0);
        if ($this->db->execute()) return $this->db->lastInsertId();
        return false;
    }

    public function updateAttribute($id, $data) {
        $this->db->query("UPDATE attributes SET group_id = :gid, name = :name, type = :type, sort_order = :sort WHERE id = :id");
        $this->db->bind(':gid', $data['group_id']);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':type', $data['type'] ?? 'text');
        $this->db->bind(':sort', $data['sort_order'] ?? 0);
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function deleteAttribute($id) {
        $this->db->query("DELETE FROM attributes WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }
}
