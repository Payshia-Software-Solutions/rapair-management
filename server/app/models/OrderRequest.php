<?php
/**
 * OrderRequest Model - structured customer requests / tasks per repair order & vehicle,
 * plus a frequency-ranked request catalog with mapped repair categories.
 */
class OrderRequest extends Model {
    private static $tableChecked = false;

    public static function normalizeKey($title) {
        $s = strtolower(trim((string)$title));
        $s = preg_replace('/[^a-z0-9]+/', ' ', $s);
        return trim((string)$s);
    }

    public function ensureTable() {
        if (self::$tableChecked) return;
        try {
            $this->db->query("
                CREATE TABLE IF NOT EXISTS repair_order_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    order_id INT NOT NULL,
                    vehicle_id INT NULL,
                    title VARCHAR(255) NOT NULL,
                    notes TEXT NULL,
                    status ENUM('Pending','In Progress','Done','Cancelled') NOT NULL DEFAULT 'Pending',
                    completed_at DATETIME NULL,
                    created_by INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ror_order (order_id),
                    INDEX idx_ror_vehicle (vehicle_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $this->db->execute();

            $this->db->query("
                CREATE TABLE IF NOT EXISTS repair_request_catalog (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    normalized_key VARCHAR(255) NOT NULL,
                    category_name VARCHAR(255) NULL,
                    usage_count INT NOT NULL DEFAULT 1,
                    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uniq_rrc_norm (normalized_key),
                    INDEX idx_rrc_usage (usage_count)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
            $this->db->execute();

            // Add category_name on existing installs if the table was created earlier without it
            try {
                $this->db->query("SHOW COLUMNS FROM repair_request_catalog LIKE 'category_name'");
                if (!$this->db->single()) {
                    $this->db->query("ALTER TABLE repair_request_catalog ADD COLUMN category_name VARCHAR(255) NULL AFTER normalized_key");
                    $this->db->execute();
                }
            } catch (Exception $e2) {}

            self::$tableChecked = true;
            $this->seedCatalogIfEmpty();
        } catch (Exception $e) {
            error_log('OrderRequest::ensureTable: ' . $e->getMessage());
        }
    }

    private function inferDefaultCategory($title) {
        $t = strtolower((string)$title);
        $rules = [
            'brake|braking|pad|disc|rotor|caliper|air line|abs' => 'Braking Systems & Air Lines',
            'service|oil|filter|preventative|maintenance|grease|coolant|fluid' => 'Scheduled Preventative Maintenance',
            'engine|diagnostic|fuel|injector|turbo|exhaust|knock|overheat' => 'Engine & Fuel System Repairs',
            'wheel|tire|tyre|alignment|balancing|puncture' => 'Tire Replacement, Alignment, and Balancing',
            'suspension|chassis|leaf|spring|shock|steering|bush|axle' => 'Chassis, Suspension, and Leaf Springs',
            'battery|light|electrical|alternator|starter|wiring|ac |a/c|air cond|regas|sensor' => 'Electrical, Battery, and Lighting',
            'body|weld|cabin|dent|paint|bumper|door|windshield|glass' => 'Bodywork, Welding, and Cabin Repairs',
        ];

        // Match against actual repair_categories names in DB if available
        $catNames = [];
        try {
            $this->db->query("SELECT name FROM repair_categories");
            $rows = $this->db->resultSet() ?: [];
            foreach ($rows as $r) $catNames[] = (string)$r->name;
        } catch (Exception $e) {}

        foreach ($rules as $pattern => $targetHint) {
            if (preg_match('/(' . $pattern . ')/i', $t)) {
                if (empty($catNames)) return $targetHint;
                foreach ($catNames as $cn) {
                    if (stripos($cn, explode(' ', $targetHint)[0]) !== false || strcasecmp($cn, $targetHint) === 0) {
                        return $cn;
                    }
                }
                return $targetHint;
            }
        }
        return null;
    }

    private function seedCatalogIfEmpty() {
        try {
            $this->db->query("SELECT COUNT(*) AS cnt FROM repair_request_catalog");
            $cnt = (int)($this->db->single()->cnt ?? 0);

            if ($cnt === 0) {
                $defaults = [
                    'Full Service & Inspection',
                    'Oil & Filter Change',
                    'Brake Pad / Disc Service',
                    'Engine Diagnostics',
                    'AC Check & Regas',
                    'Wheel Alignment / Tires',
                ];
                foreach ($defaults as $title) {
                    $this->recordCatalogUsage($title, 1, $this->inferDefaultCategory($title));
                }

                $this->db->query("SELECT title, COUNT(*) AS c FROM repair_order_requests GROUP BY title");
                $existing = $this->db->resultSet() ?: [];
                foreach ($existing as $row) {
                    $t = trim((string)($row->title ?? ''));
                    if ($t !== '') {
                        $this->recordCatalogUsage($t, max(1, (int)$row->c), $this->inferDefaultCategory($t));
                    }
                }
            }
        } catch (Exception $e) {
            // best-effort
        }
    }

    public function recordCatalogUsage($title, $increment = 1, $categoryName = null) {
        $cleanTitle = substr(trim((string)$title), 0, 255);
        $key = self::normalizeKey($cleanTitle);
        if ($cleanTitle === '' || $key === '') return;

        $cat = ($categoryName !== null && trim((string)$categoryName) !== '')
            ? substr(trim((string)$categoryName), 0, 255)
            : $this->inferDefaultCategory($cleanTitle);

        $inc = max(1, (int)$increment);
        try {
            $this->db->query("
                INSERT INTO repair_request_catalog (title, normalized_key, category_name, usage_count, last_used_at)
                VALUES (:title, :nkey, :cat, :inc, NOW())
                ON DUPLICATE KEY UPDATE
                    usage_count = usage_count + :inc2,
                    category_name = COALESCE(:cat2, category_name),
                    last_used_at = NOW()
            ");
            $this->db->bind(':title', $cleanTitle);
            $this->db->bind(':nkey', $key);
            $this->db->bind(':cat', $cat);
            $this->db->bind(':cat2', $cat);
            $this->db->bind(':inc', $inc);
            $this->db->bind(':inc2', $inc);
            $this->db->execute();
        } catch (Exception $e) {
            // ignore
        }
    }

    public function getCatalog($limit = 300) {
        $this->ensureTable();
        // Backfill null categories on starter/existing items if possible
        try {
            $this->db->query("SELECT id, title FROM repair_request_catalog WHERE category_name IS NULL LIMIT 50");
            $nulls = $this->db->resultSet() ?: [];
            foreach ($nulls as $n) {
                $inferred = $this->inferDefaultCategory($n->title);
                if ($inferred) {
                    $this->db->query("UPDATE repair_request_catalog SET category_name = :c WHERE id = :id");
                    $this->db->bind(':c', $inferred);
                    $this->db->bind(':id', (int)$n->id);
                    $this->db->execute();
                }
            }
        } catch (Exception $e) {}

        $lim = max(1, min(1000, (int)$limit));
        $this->db->query("
            SELECT id, title, normalized_key, category_name, usage_count, last_used_at
            FROM repair_request_catalog
            ORDER BY usage_count DESC, last_used_at DESC, title ASC
            LIMIT $lim
        ");
        return $this->db->resultSet() ?: [];
    }

    public function listByOrder($orderId) {
        $oid = (int)$orderId;
        if ($oid <= 0) return [];
        try {
            $this->db->query("SELECT * FROM repair_order_requests WHERE order_id = :oid ORDER BY id ASC");
            $this->db->bind(':oid', $oid);
            return $this->db->resultSet() ?: [];
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1146) {
                $this->ensureTable();
                return [];
            }
            return [];
        }
    }

    public function listGroupedByOrders(array $orderIds) {
        $ids = array_values(array_unique(array_filter(array_map('intval', $orderIds), fn($x) => $x > 0)));
        if (empty($ids)) return [];
        try {
            $in = implode(',', $ids);
            $this->db->query("SELECT * FROM repair_order_requests WHERE order_id IN ($in) ORDER BY id ASC");
            $rows = $this->db->resultSet() ?: [];
            $out = [];
            foreach ($rows as $r) {
                $out[(int)$r->order_id][] = $r;
            }
            return $out;
        } catch (PDOException $e) {
            if ((int)($e->errorInfo[1] ?? 0) === 1146) {
                $this->ensureTable();
                return [];
            }
            return [];
        }
    }

    public function insertBatch($orderId, $vehicleId, array $items, $userId = null) {
        $oid = (int)$orderId;
        if ($oid <= 0 || empty($items)) return;
        $this->ensureTable();
        $vid = $vehicleId ? (int)$vehicleId : null;

        $seenKeys = [];
        foreach ($items as $item) {
            $title = is_string($item) ? trim($item) : trim((string)($item['title'] ?? ''));
            if ($title === '') continue;
            $nkey = self::normalizeKey($title);
            if ($nkey !== '' && isset($seenKeys[$nkey])) continue;
            if ($nkey !== '') $seenKeys[$nkey] = true;

            $notes = is_array($item) && isset($item['notes']) ? trim((string)$item['notes']) : null;
            $catName = is_array($item) && isset($item['category_name']) ? trim((string)$item['category_name']) : null;
            $status = is_array($item) && !empty($item['status']) ? (string)$item['status'] : 'Pending';
            if (!in_array($status, ['Pending', 'In Progress', 'Done', 'Cancelled'], true)) {
                $status = 'Pending';
            }

            $this->db->query("
                INSERT INTO repair_order_requests (order_id, vehicle_id, title, notes, status, created_by)
                VALUES (:oid, :vid, :title, :notes, :status, :u)
            ");
            $this->db->bind(':oid', $oid);
            $this->db->bind(':vid', $vid);
            $this->db->bind(':title', substr($title, 0, 255));
            $this->db->bind(':notes', $notes !== '' ? $notes : null);
            $this->db->bind(':status', $status);
            $this->db->bind(':u', $userId);
            $this->db->execute();

            $this->recordCatalogUsage($title, 1, $catName);
        }
    }

    public function addOne($orderId, $vehicleId, $title, $notes = null, $userId = null, $categoryName = null) {
        $this->ensureTable();
        $cleanTitle = substr(trim((string)$title), 0, 255);
        $this->db->query("
            INSERT INTO repair_order_requests (order_id, vehicle_id, title, notes, status, created_by)
            VALUES (:oid, :vid, :title, :notes, 'Pending', :u)
        ");
        $this->db->bind(':oid', (int)$orderId);
        $this->db->bind(':vid', $vehicleId ? (int)$vehicleId : null);
        $this->db->bind(':title', $cleanTitle);
        $this->db->bind(':notes', ($notes !== null && trim((string)$notes) !== '') ? trim((string)$notes) : null);
        $this->db->bind(':u', $userId);
        if ($this->db->execute()) {
            $newId = (int)$this->db->lastInsertId();
            $this->recordCatalogUsage($cleanTitle, 1, $categoryName);
            return $newId;
        }
        return false;
    }

    public function getOne($reqId) {
        try {
            $this->db->query("SELECT * FROM repair_order_requests WHERE id = :id LIMIT 1");
            $this->db->bind(':id', (int)$reqId);
            return $this->db->single();
        } catch (PDOException $e) {
            return null;
        }
    }

    public function updateOne($reqId, array $fields) {
        $this->ensureTable();
        $sets = [];
        $binds = [':id' => (int)$reqId];
        if (isset($fields['title']) && trim((string)$fields['title']) !== '') {
            $sets[] = "title = :title";
            $binds[':title'] = substr(trim((string)$fields['title']), 0, 255);
        }
        if (array_key_exists('notes', $fields)) {
            $sets[] = "notes = :notes";
            $n = trim((string)($fields['notes'] ?? ''));
            $binds[':notes'] = $n !== '' ? $n : null;
        }
        if (isset($fields['status']) && in_array($fields['status'], ['Pending', 'In Progress', 'Done', 'Cancelled'], true)) {
            $sets[] = "status = :status";
            $binds[':status'] = $fields['status'];
            $sets[] = $fields['status'] === 'Done' ? "completed_at = COALESCE(completed_at, NOW())" : "completed_at = NULL";
        }
        if (empty($sets)) return false;

        $this->db->query("UPDATE repair_order_requests SET " . implode(', ', $sets) . " WHERE id = :id");
        foreach ($binds as $k => $v) $this->db->bind($k, $v);
        return $this->db->execute();
    }

    public function deleteOne($reqId) {
        $this->ensureTable();
        $this->db->query("DELETE FROM repair_order_requests WHERE id = :id");
        $this->db->bind(':id', (int)$reqId);
        return $this->db->execute();
    }
}
