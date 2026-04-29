<?php
/**
 * BanquetResource Model - Manage banquet resources (Internal/External)
 */
class BanquetResource extends Model {
    public function getAll($activeOnly = false) {
        $sql = "SELECT r.*, s.name as default_supplier_name FROM banquet_resources r
                LEFT JOIN suppliers s ON r.default_supplier_id = s.id";
        if ($activeOnly) $sql .= " WHERE r.is_active = 1";
        $sql .= " ORDER BY r.name ASC";
        $this->db->query($sql);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("INSERT INTO banquet_resources (name, resource_type, base_price, selling_price, default_supplier_id, is_active) 
                          VALUES (:name, :resource_type, :base_price, :selling_price, :default_supplier_id, :is_active)");
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':resource_type', $data['resource_type'] ?? 'Internal');
        $this->db->bind(':base_price', $data['base_price'] ?? 0);
        $this->db->bind(':selling_price', $data['selling_price'] ?? 0);
        $this->db->bind(':default_supplier_id', $data['default_supplier_id'] ? $data['default_supplier_id'] : null);
        $this->db->bind(':is_active', $data['is_active'] ?? 1);
        return $this->db->execute();
    }

    public function update($id, $data) {
        $this->db->query("UPDATE banquet_resources SET name = :name, resource_type = :resource_type, 
                          base_price = :base_price, selling_price = :selling_price, default_supplier_id = :default_supplier_id, is_active = :is_active WHERE id = :id");
        $this->db->bind(':id', $id);
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':resource_type', $data['resource_type']);
        $this->db->bind(':base_price', $data['base_price']);
        $this->db->bind(':selling_price', $data['selling_price']);
        $this->db->bind(':default_supplier_id', $data['default_supplier_id'] ? $data['default_supplier_id'] : null);
        $this->db->bind(':is_active', $data['is_active']);
        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM banquet_resources WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getAssignments($bookingId) {
        $this->db->query("SELECT a.*, r.name as resource_name, s.name as vendor_name 
                          FROM banquet_event_assignments a
                          LEFT JOIN banquet_resources r ON a.resource_id = r.id
                          LEFT JOIN suppliers s ON a.vendor_id = s.id
                          WHERE a.booking_id = :bid");
        $this->db->bind(':bid', $bookingId);
        return $this->db->resultSet();
    }

    public function assign($data) {
        $this->db->query("INSERT INTO banquet_event_assignments 
                          (booking_id, resource_id, vendor_id, description, qty, unit_cost, unit_price, notes) 
                          VALUES (:booking_id, :resource_id, :vendor_id, :description, :qty, :unit_cost, :unit_price, :notes)");
        $this->db->bind(':booking_id', $data['booking_id']);
        $this->db->bind(':resource_id', $data['resource_id'] ?? null);
        $this->db->bind(':vendor_id', $data['vendor_id'] ?? null);
        $this->db->bind(':description', $data['description']);
        $this->db->bind(':qty', $data['qty'] ?? 1);
        $this->db->bind(':unit_cost', $data['unit_cost'] ?? 0);
        $this->db->bind(':unit_price', $data['unit_price'] ?? 0);
        $this->db->bind(':notes', $data['notes'] ?? null);
        
        if ($this->db->execute()) {
            $this->updateBookingTotals($data['booking_id']);
            return true;
        }
        return false;
    }

    public function removeAssignment($id) {
        $this->db->query("SELECT booking_id FROM banquet_event_assignments WHERE id = :id");
        $this->db->bind(':id', $id);
        $row = $this->db->single();
        
        $this->db->query("DELETE FROM banquet_event_assignments WHERE id = :id");
        $this->db->bind(':id', $id);
        if ($this->db->execute() && $row) {
            $this->updateBookingTotals($row->booking_id);
            return true;
        }
        return false;
    }

    private function updateBookingTotals($bookingId) {
        // Calculate total amount (selling price) and total cost for assigned resources
        $this->db->query("SELECT SUM(qty * unit_price) as total_price, SUM(qty * unit_cost) as total_cost 
                          FROM banquet_event_assignments WHERE booking_id = :bid AND status != 'Cancelled'");
        $this->db->bind(':bid', $bookingId);
        $res = $this->db->single();
        
        $extraPrice = (float)($res->total_price ?? 0);
        $extraCost = (float)($res->total_cost ?? 0);

        // We should probably store these extras separately or update the booking's main total
        // For now, let's just ensure we have these numbers available.
        // I'll update the booking table's total_amount to include extras if we want them in the invoice.
        // Actually, it's better to calculate the full total on the fly or during invoicing.
    }
}
