<?php
/**
 * Customer Model
 */

class Customer extends Model {
    private $table = 'customers';
    private static $creditColChecked = false;

    public function __construct() {
        parent::__construct();
        $this->ensureCreditApprovedColumn();
    }

    public function ensureCreditApprovedColumn() {
        if (self::$creditColChecked) return;
        try {
            $this->db->query("SHOW COLUMNS FROM {$this->table} LIKE 'credit_approved'");
            if (!$this->db->single()) {
                $this->db->query("ALTER TABLE {$this->table} ADD COLUMN credit_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER credit_days");
                $this->db->execute();
                // Existing customers that already have a positive credit limit stay approved once on migration.
                $this->db->query("UPDATE {$this->table} SET credit_approved = 1 WHERE credit_limit > 0");
                $this->db->execute();
            }
            self::$creditColChecked = true;
        } catch (Exception $e) {
            error_log('Customer credit_approved column: ' . $e->getMessage());
        }
    }

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
            (name, phone, email, address, nic, tax_number, order_type, is_active, is_unsubscribed, credit_limit, credit_days, credit_approved, is_ecommerce_user, created_by, updated_by, latitude, longitude, photo_url, qr_code_hash, route_id) 
            VALUES 
            (:name, :phone, :email, :address, :nic, :tax_number, :order_type, :is_active, :is_unsubscribed, :credit_limit, :credit_days, :credit_approved, :is_ecommerce_user, :created_by, :updated_by, :latitude, :longitude, :photo_url, :qr_code_hash, :route_id)
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
        $this->db->bind(':credit_approved', !empty($data['credit_approved']) && $data['credit_approved'] !== '0' && $data['credit_approved'] !== 'false' ? 1 : 0);
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
                credit_approved = :credit_approved,
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
        $this->db->bind(':credit_approved', !empty($data['credit_approved']) && $data['credit_approved'] !== '0' && $data['credit_approved'] !== 'false' ? 1 : 0);
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

    /**
     * Customer 360: profile, money, activity and every module's records for one customer.
     * Optional modules (loyalty, vouchers, credit notes, hotel, service) are read only when their
     * tables exist, so a workspace without them still gets a full answer.
     */
    public function getSummary($id) {
        $customer = $this->getById($id);
        if (!$customer) return null;
        $id = (int)$id;
        unset($customer->password); // portal login hash never leaves the server

        $rows = function ($sql) use ($id) {
            try {
                $this->db->query($sql);
                if (strpos($sql, ':id') !== false) $this->db->bind(':id', $id);
                return $this->db->resultSet();
            } catch (Exception $e) {
                return []; // module not installed in this workspace
            }
        };
        $one = function ($sql) use ($rows) { $r = $rows($sql); return $r[0] ?? null; };

        $invoices = $rows("SELECT id, invoice_no, issue_date, due_date, grand_total, paid_amount, status, order_type, created_at
                           FROM invoices WHERE customer_id = :id ORDER BY id DESC LIMIT 50");
        $payments = $rows("SELECT id, receipt_no, invoice_id, invoice_no, amount, payment_method, payment_date, status, created_at
                           FROM payment_receipts WHERE customer_id = :id ORDER BY id DESC LIMIT 50");
        $reservations = $rows("SELECT r.*, rm.room_number AS room_no FROM hotel_reservations r LEFT JOIN hotel_rooms rm ON rm.id = r.room_id
                               WHERE r.customer_id = :id ORDER BY r.id DESC LIMIT 20");
        if (!$reservations) $reservations = $rows("SELECT * FROM hotel_reservations WHERE customer_id = :id ORDER BY id DESC LIMIT 20");

        $stats = $one("
            SELECT COUNT(*) AS total_invoices,
                   COALESCE(SUM(grand_total), 0) AS total_spent,
                   COALESCE(SUM(paid_amount), 0) AS total_paid,
                   COALESCE(AVG(grand_total), 0) AS avg_invoice,
                   COALESCE(SUM(GREATEST(grand_total - paid_amount, 0)), 0) AS outstanding,
                   COALESCE(SUM(CASE WHEN due_date < CURDATE() AND grand_total > paid_amount THEN grand_total - paid_amount ELSE 0 END), 0) AS overdue,
                   SUM(CASE WHEN due_date < CURDATE() AND grand_total > paid_amount THEN 1 ELSE 0 END) AS overdue_invoices,
                   MIN(issue_date) AS first_purchase,
                   MAX(issue_date) AS last_purchase,
                   COALESCE(SUM(CASE WHEN issue_date >= CURDATE() - INTERVAL 90 DAY THEN grand_total ELSE 0 END), 0) AS spent_90d,
                   COALESCE(SUM(CASE WHEN issue_date >= CURDATE() - INTERVAL 180 DAY AND issue_date < CURDATE() - INTERVAL 90 DAY THEN grand_total ELSE 0 END), 0) AS spent_prev_90d
            FROM invoices WHERE customer_id = :id AND status != 'Cancelled'") ?: (object)[];
        $stays = $one("SELECT COUNT(*) AS n FROM hotel_reservations WHERE customer_id = :id AND status = 'CheckedOut'");
        $stats->total_stays = $stays ? (int)$stays->n : 0;

        // Spending per month, last 12 months (missing months are filled in by the page)
        $monthly = $rows("SELECT DATE_FORMAT(issue_date, '%Y-%m') AS month, SUM(grand_total) AS total, COUNT(*) AS invoices
                          FROM invoices WHERE customer_id = :id AND status != 'Cancelled'
                            AND issue_date >= DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01')
                          GROUP BY month ORDER BY month");

        $items = $rows("
            SELECT ii.description AS item_name, SUM(ii.quantity) AS total_qty, AVG(ii.unit_price) AS avg_price,
                   SUM(ii.line_total) AS total_spent, MAX(i.issue_date) AS last_purchased, COUNT(DISTINCT i.id) AS times
            FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
            WHERE i.customer_id = :id AND i.status != 'Cancelled'
            GROUP BY ii.description ORDER BY total_spent DESC LIMIT 50");

        $paymentMethods = $rows("SELECT payment_method, COUNT(*) AS n, SUM(amount) AS total FROM payment_receipts
                                 WHERE customer_id = :id AND (status IS NULL OR status != 'Cancelled')
                                 GROUP BY payment_method ORDER BY total DESC");

        // Other modules
        $vehicles = $rows("SELECT id, make, model, year, vin, image_filename, created_at FROM vehicles WHERE customer_id = :id ORDER BY id DESC");
        $orders = $rows("SELECT id, vehicle_identifier, vehicle_model, problem_description, status, priority, mileage, technician, created_at, completed_at
                         FROM repair_orders WHERE customer_id = :id ORDER BY id DESC LIMIT 30");
        $quotations = $rows("SELECT id, quotation_no, issue_date, expiry_date, status, grand_total, converted_invoice_id
                             FROM quotations WHERE customer_id = :id ORDER BY id DESC LIMIT 30");
        $returns = $rows("SELECT id, return_no, invoice_id, return_date, total_amount, reason, status
                          FROM sales_returns WHERE customer_id = :id ORDER BY id DESC LIMIT 30");
        $creditNotes = $rows("SELECT * FROM credit_notes WHERE customer_id = :id ORDER BY id DESC LIMIT 30");
        $vouchers = $rows("SELECT id, code, initial_value, balance, status, source, expires_at, created_at
                           FROM gift_vouchers WHERE customer_id = :id ORDER BY id DESC LIMIT 30");

        $loyalty = null;
        $member = $one("SELECT m.*, t.name AS tier_name, t.color AS tier_color, t.discount_pct
                        FROM loyalty_members m LEFT JOIN loyalty_tiers t ON t.id = m.tier_id WHERE m.customer_id = :id");
        if ($member) {
            $next = $rows("SELECT name, threshold FROM loyalty_tiers WHERE is_active = 1 ORDER BY threshold");
            $ledger = $rows("SELECT l.type, l.points, l.amount, l.invoice_id, l.note, l.created_at
                             FROM loyalty_ledger l JOIN loyalty_members m ON m.id = l.member_id
                             WHERE m.customer_id = :id ORDER BY l.id DESC LIMIT 20");
            $loyalty = ['member' => $member, 'tiers' => $next, 'ledger' => $ledger];
        }

        return [
            'customer' => $customer,
            'invoices' => $invoices,
            'payments' => $payments,
            'reservations' => $reservations,
            'stats' => $stats,
            'monthly' => $monthly,
            'purchased_items' => $items,
            'payment_methods' => $paymentMethods,
            'vehicles' => $vehicles,
            'orders' => $orders,
            'quotations' => $quotations,
            'returns' => $returns,
            'credit_notes' => $creditNotes,
            'gift_vouchers' => $vouchers,
            'loyalty' => $loyalty,
        ];
    }
}
