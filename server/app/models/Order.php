<?php
/**
 * Order Model
 */

class Order extends Model {
    private $table = 'repair_orders';

    private function ensureRepairOrderColumns() {
        // Auto-migrate older installs so order create never fails with "Unknown column ...".
        // This mirrors InstallController::ensureSchema() for repair_orders.
        $cols = [
            'location_id' => "INT NULL",
            'vehicle_id' => "INT NULL",
            'vehicle_identifier' => "VARCHAR(100) NULL",
            'mileage' => "INT NULL",
            'priority' => "VARCHAR(20) NULL",
            'expected_time' => "DATETIME NULL",
            'comments' => "TEXT NULL",
            'categories_json' => "TEXT NULL",
            'checklist_json' => "TEXT NULL",
            'attachments_json' => "TEXT NULL",
            'location' => "VARCHAR(50) NULL",
            'technician' => "VARCHAR(255) NULL",
            'created_by' => "INT NULL",
            'updated_by' => "INT NULL",
        ];

        foreach ($cols as $col => $def) {
            try {
                $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE '{$col}'");
                $exists = (bool)$this->db->single();
                if (!$exists) {
                    $this->db->exec("ALTER TABLE {$this->table} ADD COLUMN {$col} {$def}");
                }
            } catch (Exception $e) {
                // Ignore: we'll surface a normal create failure later if DB is unreachable.
            }
        }
    }

    // Get all orders
    public function getOrders() {
        $this->db->query("SELECT * FROM " . $this->table . " ORDER BY created_at DESC");
        return $this->db->resultSet();
    }

    public function getOrdersByLocation($locationId) {
        $this->ensureRepairOrderColumns();
        $this->db->query("SELECT * FROM {$this->table} WHERE location_id = :location_id ORDER BY created_at DESC");
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->resultSet();
    }

    // Get order by ID
    public function getOrderById($id) {
        $this->db->query("SELECT * FROM " . $this->table . " WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function getOrderByIdInLocation($id, $locationId) {
        $this->ensureRepairOrderColumns();
        $this->db->query("SELECT * FROM {$this->table} WHERE id = :id AND location_id = :location_id LIMIT 1");
        $this->db->bind(':id', (int)$id);
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->single();
    }

    // Add Order
    public function addOrder($data, $userId = null, $locationId = 1) {
        $this->ensureRepairOrderColumns();
        $this->db->query("
            INSERT INTO {$this->table}
            (location_id, customer_name, vehicle_model, problem_description, status, vehicle_id, vehicle_identifier, mileage, priority, expected_time, comments, categories_json, checklist_json, attachments_json, location, technician, created_by, updated_by)
            VALUES
            (:location_id, :customer_name, :vehicle_model, :problem_description, :status, :vehicle_id, :vehicle_identifier, :mileage, :priority, :expected_time, :comments, :categories_json, :checklist_json, :attachments_json, :location, :technician, :created_by, :updated_by)
        ");
        
        // Bind values
        $this->db->bind(':location_id', (int)$locationId);
        $this->db->bind(':customer_name', $data['customer_name']);
        $this->db->bind(':vehicle_model', $data['vehicle_model']);
        $this->db->bind(':problem_description', $data['problem_description']);
        $this->db->bind(':status', $data['status'] ?? 'Pending');
        $this->db->bind(':vehicle_id', $data['vehicle_id'] ?? null);
        $this->db->bind(':vehicle_identifier', $data['vehicle_identifier'] ?? null);
        $this->db->bind(':mileage', $data['mileage'] ?? null);
        $this->db->bind(':priority', $data['priority'] ?? null);
        $this->db->bind(':expected_time', $data['expected_time'] ?? null);
        $this->db->bind(':comments', $data['comments'] ?? null);
        $this->db->bind(':categories_json', $data['categories_json'] ?? null);
        $this->db->bind(':checklist_json', $data['checklist_json'] ?? null);
        $this->db->bind(':attachments_json', $data['attachments_json'] ?? null);
        $this->db->bind(':location', $data['location'] ?? null);
        $this->db->bind(':technician', $data['technician'] ?? null);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);

        try {
            $ok = $this->db->execute();
            if (!$ok) return false;
            return (int)$this->db->lastInsertId();
        } catch (PDOException $e) {
            // One more attempt after migrating (covers cases where the first ensure failed due to race/permissions).
            if (stripos($e->getMessage(), 'Unknown column') !== false) {
                $this->ensureRepairOrderColumns();
                try {
                    $ok2 = $this->db->execute();
                    if (!$ok2) return false;
                    return (int)$this->db->lastInsertId();
                } catch (PDOException $e2) {
                    return false;
                }
            }
            return false;
        }
    }

    // Update Status
    public function updateStatus($id, $status, $userId = null, $locationId = 1) {
        $this->ensureRepairOrderColumns();
        $this->db->query("UPDATE {$this->table} SET status = :status, updated_by = :updated_by WHERE id = :id AND location_id = :location_id");
        $this->db->bind(':status', $status);
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);
        $this->db->bind(':location_id', (int)$locationId);
        return $this->db->execute();
    }
}
