<?php
/**
 * Customer Model
 */

class Customer extends Model {
    private $table = 'customers';

    public function getAll() {
        $this->db->query("
            SELECT c.*, 
                   (SELECT COALESCE(SUM(i.grand_total - i.paid_amount), 0) 
                    FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status != 'Cancelled') as total_outstanding,
                   (SELECT MAX(cv.created_at) FROM customer_visits cv WHERE cv.customer_id = c.id) as last_visit_date
            FROM {$this->table} c 
            ORDER BY c.name ASC
        ");
        return $this->db->resultSet();
    }

    public function getEcommerceCustomers() {
        $this->db->query("
            SELECT c.*, 
                   (SELECT COUNT(*) FROM online_orders o WHERE o.customer_id = c.id) as total_store_orders
            FROM {$this->table} c 
            WHERE c.is_ecommerce_user = 1
            ORDER BY c.name ASC
        ");
        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT c.*, 
                   (SELECT COALESCE(SUM(i.grand_total - i.paid_amount), 0) 
                    FROM invoices i 
                    WHERE i.customer_id = c.id AND i.status != 'Cancelled') as total_outstanding,
                   (SELECT MAX(cv.created_at) FROM customer_visits cv WHERE cv.customer_id = c.id) as last_visit_date
            FROM {$this->table} c 
            WHERE c.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    /**
     * Sri Lankan mobile/landline to one form (0XXXXXXXXX). Other numbers keep their digits only.
     */
    public static function normalizePhone($phone) {
        $d = preg_replace('/\D+/', '', (string)$phone);
        if (strlen($d) === 11 && strpos($d, '94') === 0) $d = '0' . substr($d, 2);
        elseif (strlen($d) === 9 && $d[0] !== '0') $d = '0' . $d;
        return $d;
    }

    /** Old NIC (9 digits + V/X) or new NIC (12 digits), upper-cased; '' when empty, null when invalid. */
    public static function normalizeNic($nic) {
        $n = strtoupper(preg_replace('/\s+/', '', (string)$nic));
        if ($n === '') return '';
        return preg_match('/^(\d{9}[VX]|\d{12})$/', $n) ? $n : null;
    }

    /** Adds the date-of-birth column on first use (loyalty birthday points read it). */
    public function ensureDobColumn() {
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'dob'");
            if (!$this->db->single()) {
                $this->db->query("ALTER TABLE {$this->table} ADD COLUMN dob DATE NULL");
                $this->db->execute();
            }
        } catch (Exception $e) {
            error_log('Customer dob column: ' . $e->getMessage());
        }
    }

    /**
     * Existing customer with this phone (compared on the last 9 digits, so 077..., +9477... and
     * 9477... match) or this NIC. Returns the row with `matched_on` = 'phone' | 'nic', or null.
     */
    public function findByPhoneOrNic($phone, $nic) {
        $tail = substr(preg_replace('/\D+/', '', (string)$phone), -9);
        if (strlen($tail) === 9) {
            $this->db->query("SELECT id, name, phone, nic, email FROM {$this->table}
                WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', ''), 9) = :t ORDER BY id LIMIT 1");
            $this->db->bind(':t', $tail);
            $row = $this->db->single();
            if ($row) { $row->matched_on = 'phone'; return $row; }
        }
        if ($nic) {
            $this->db->query("SELECT id, name, phone, nic, email FROM {$this->table}
                WHERE UPPER(REPLACE(COALESCE(nic, ''), ' ', '')) = :n ORDER BY id LIMIT 1");
            $this->db->bind(':n', $nic);
            $row = $this->db->single();
            if ($row) { $row->matched_on = 'nic'; return $row; }
        }
        return null;
    }

    /** Minimal customer created from the POS. Returns the new id or false. */
    public function createFromPos(array $d, $userId = null) {
        $this->db->query("INSERT INTO {$this->table}
            (name, phone, nic, email, address, dob, order_type, is_active, created_by, updated_by)
            VALUES (:name, :phone, :nic, :email, :address, :dob, 'External', 1, :u, :u2)");
        $this->db->bind(':name', $d['name']);
        $this->db->bind(':phone', $d['phone'] ?: null);
        $this->db->bind(':nic', $d['nic'] ?: null);
        $this->db->bind(':email', $d['email'] ?: null);
        $this->db->bind(':address', $d['address'] ?: null);
        $this->db->bind(':dob', $d['dob'] ?: null);
        $this->db->bind(':u', $userId);
        $this->db->bind(':u2', $userId);
        if (!$this->db->execute()) return false;
        $id = (int)$this->db->lastInsertId();
        $this->db->query("UPDATE {$this->table} SET qr_code_hash = :q WHERE id = :id");
        $this->db->bind(':q', 'CUSTOMER:' . $id);
        $this->db->bind(':id', $id);
        $this->db->execute();
        return $id;
    }

    public function create($data, $userId = null) {
        $this->db->query("
            INSERT INTO {$this->table} 
            (name, phone, email, address, nic, tax_number, order_type, is_active, is_unsubscribed, credit_limit, credit_days, is_ecommerce_user, created_by, updated_by, latitude, longitude, photo_url, qr_code_hash, route_id) 
            VALUES 
            (:name, :phone, :email, :address, :nic, :tax_number, :order_type, :is_active, :is_unsubscribed, :credit_limit, :credit_days, :is_ecommerce_user, :created_by, :updated_by, :latitude, :longitude, :photo_url, :qr_code_hash, :route_id)
        ");
        
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':tax_number', $data['tax_number'] ?? null);
        $this->db->bind(':order_type', $data['order_type'] ?? 'External');
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
        $this->db->bind(':is_unsubscribed', isset($data['is_unsubscribed']) ? (int)$data['is_unsubscribed'] : 0);
        $this->db->bind(':credit_limit', $data['credit_limit'] ?? 0);
        $this->db->bind(':credit_days', $data['credit_days'] ?? 0);
        $this->db->bind(':is_ecommerce_user', isset($data['is_ecommerce_user']) ? (int)$data['is_ecommerce_user'] : 0);
        $this->db->bind(':created_by', $userId);
        $this->db->bind(':updated_by', $userId);

        $this->db->bind(':latitude', $data['latitude'] ?? null);
        $this->db->bind(':longitude', $data['longitude'] ?? null);
        $this->db->bind(':photo_url', $data['photo_url'] ?? null);
        $this->db->bind(':qr_code_hash', $data['qr_code_hash'] ?? null);
        $this->db->bind(':route_id', !empty($data['route_id']) ? (int)$data['route_id'] : null);

        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function update($id, $data, $userId = null) {
        $updateQuery = "
            UPDATE {$this->table} 
            SET name = :name, 
                phone = :phone, 
                email = :email, 
                address = :address, 
                nic = :nic, 
                tax_number = :tax_number, 
                order_type = :order_type, 
                is_active = :is_active, 
                is_unsubscribed = :is_unsubscribed,
                credit_limit = :credit_limit,
                credit_days = :credit_days,
                is_ecommerce_user = :is_ecommerce_user,
                latitude = :latitude,
                longitude = :longitude,
                route_id = :route_id,
                updated_by = :updated_by";
                
        if (isset($data['photo_url'])) {
            $updateQuery .= ", photo_url = :photo_url";
        }
        if (isset($data['qr_code_hash'])) {
            $updateQuery .= ", qr_code_hash = :qr_code_hash";
        }
                
        $updateQuery .= " WHERE id = :id";
        
        $this->db->query($updateQuery);
        
        $this->db->bind(':name', $data['name']);
        $this->db->bind(':phone', $data['phone'] ?? null);
        $this->db->bind(':email', $data['email'] ?? null);
        $this->db->bind(':address', $data['address'] ?? null);
        $this->db->bind(':nic', $data['nic'] ?? null);
        $this->db->bind(':tax_number', $data['tax_number'] ?? null);
        $this->db->bind(':order_type', $data['order_type'] ?? 'External');
        $this->db->bind(':is_active', isset($data['is_active']) ? (int)$data['is_active'] : 1);
        $this->db->bind(':is_unsubscribed', isset($data['is_unsubscribed']) ? (int)$data['is_unsubscribed'] : 0);
        $this->db->bind(':credit_limit', $data['credit_limit'] ?? 0);
        $this->db->bind(':credit_days', $data['credit_days'] ?? 0);
        $this->db->bind(':is_ecommerce_user', isset($data['is_ecommerce_user']) ? (int)$data['is_ecommerce_user'] : 0);
        
        $this->db->bind(':latitude', $data['latitude'] ?? null);
        $this->db->bind(':longitude', $data['longitude'] ?? null);
        $this->db->bind(':route_id', !empty($data['route_id']) ? (int)$data['route_id'] : null);
        
        if (isset($data['photo_url'])) {
            $this->db->bind(':photo_url', $data['photo_url']);
        }
        if (isset($data['qr_code_hash'])) {
            $this->db->bind(':qr_code_hash', $data['qr_code_hash']);
        }
        
        $this->db->bind(':updated_by', $userId);
        $this->db->bind(':id', $id);

        return $this->db->execute();
    }

    public function delete($id) {
        $this->db->query("DELETE FROM {$this->table} WHERE id = :id");
        $this->db->bind(':id', $id);
        return $this->db->execute();
    }

    public function getSummary($id) {
        $customer = $this->getById($id);
        if (!$customer) return null;

        // 1. Recent Invoices
        $this->db->query("SELECT * FROM invoices WHERE customer_id = :id ORDER BY id DESC LIMIT 10");
        $this->db->bind(':id', $id);
        $invoices = $this->db->resultSet();

        // 2. Recent Payments
        $this->db->query("SELECT * FROM payment_receipts WHERE customer_id = :id ORDER BY id DESC LIMIT 10");
        $this->db->bind(':id', $id);
        $payments = $this->db->resultSet();

        // 3. Recent Reservations
        $this->db->query("SELECT * FROM hotel_reservations WHERE customer_id = :id ORDER BY id DESC LIMIT 10");
        $this->db->bind(':id', $id);
        $reservations = $this->db->resultSet();

        // 4. Lifetime Statistics
        $this->db->query("
            SELECT 
                COUNT(*) as total_invoices,
                COALESCE(SUM(grand_total), 0) as total_spent,
                COALESCE(SUM(paid_amount), 0) as total_paid,
                (SELECT COUNT(*) FROM hotel_reservations WHERE customer_id = :id AND status = 'CheckedOut') as total_stays
            FROM invoices 
            WHERE customer_id = :id AND status != 'Cancelled'
        ");
        $this->db->bind(':id', $id);
        $stats = $this->db->single();

        // 5. Purchased Items (Aggregated)
        $this->db->query("
            SELECT 
                ii.description as item_name,
                SUM(ii.quantity) as total_qty,
                AVG(ii.unit_price) as avg_price,
                SUM(ii.line_total) as total_spent,
                MAX(i.issue_date) as last_purchased
            FROM invoice_items ii
            JOIN invoices i ON i.id = ii.invoice_id
            WHERE i.customer_id = :id AND i.status != 'Cancelled'
            GROUP BY ii.description
            ORDER BY total_spent DESC
            LIMIT 50
        ");
        $this->db->bind(':id', $id);
        $items = $this->db->resultSet();

        return [
            'customer' => $customer,
            'invoices' => $invoices,
            'payments' => $payments,
            'reservations' => $reservations,
            'stats' => $stats,
            'purchased_items' => $items
        ];
    }
}
