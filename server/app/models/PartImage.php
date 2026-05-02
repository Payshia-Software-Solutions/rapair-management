<?php
/**
 * PartImage Model
 * Manages product image gallery.
 */
class PartImage extends Model {
    
    public function getByPart($partId) {
        $this->db->query("SELECT * FROM part_images WHERE part_id = :pid ORDER BY sort_order ASC, id ASC");
        $this->db->bind(':pid', (int)$partId);
        return $this->db->resultSet();
    }

    public function add($partId, $filename, $label = null, $sortOrder = 0) {
        $this->db->query("
            INSERT INTO part_images (part_id, filename, label, sort_order)
            VALUES (:pid, :fn, :lbl, :sort)
        ");
        $this->db->bind(':pid', (int)$partId);
        $this->db->bind(':fn', $filename);
        $this->db->bind(':lbl', $label);
        $this->db->bind(':sort', (int)$sortOrder);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM part_images WHERE id = :id");
        $this->db->bind(':id', (int)$id);
        return $this->db->execute();
    }

    public function syncGallery($partId, $images) {
        $pid = (int)$partId;
        // Basic sync: update labels and sort order for existing ones
        foreach ($images as $img) {
            if (isset($img['id'])) {
                $this->db->query("
                    UPDATE part_images 
                    SET label = :lbl, sort_order = :sort 
                    WHERE id = :id AND part_id = :pid
                ");
                $this->db->bind(':lbl', $img['label'] ?? null);
                $this->db->bind(':sort', (int)($img['sort_order'] ?? 0));
                $this->db->bind(':id', (int)$img['id']);
                $this->db->bind(':pid', $pid);
                $this->db->execute();
            }
        }
        return true;
    }
}
