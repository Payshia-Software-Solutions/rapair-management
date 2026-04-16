<?php
/**
 * Invoice Model
 */
class Invoice extends Model {
    private $table = 'invoices';

    public function getAll($filters = []) {
        $sql = "
            SELECT i.*, c.name as customer_name, ro.customer_name as order_customer_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN repair_orders ro ON i.order_id = ro.id
            WHERE 1=1
        ";

        if (!empty($filters['status'])) {
            $sql .= " AND i.status = :status";
        }
        if (!empty($filters['customer_id'])) {
            $sql .= " AND i.customer_id = :customer_id";
        }

        $sql .= " ORDER BY i.created_at DESC";

        $this->db->query($sql);
        if (!empty($filters['status'])) $this->db->bind(':status', $filters['status']);
        if (!empty($filters['customer_id'])) $this->db->bind(':customer_id', $filters['customer_id']);

        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT i.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address, 
                   c.tax_number as customer_tax_no, ro.customer_name as order_ref_name,
                   sl.name as location_name, sl.address as location_address, sl.phone as location_phone,
                   sl.tax_no as location_tax_no, sl.tax_label as location_tax_label
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN repair_orders ro ON i.order_id = ro.id
            LEFT JOIN service_locations sl ON i.location_id = sl.id
            WHERE i.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function getItems($invoiceId) {
        $this->db->query("SELECT * FROM invoice_items WHERE invoice_id = :invoice_id ORDER BY id ASC");
        $this->db->bind(':invoice_id', $invoiceId);
        return $this->db->resultSet();
    }

    public function getPayments($invoiceId) {
        $this->db->query("SELECT * FROM invoice_payments WHERE invoice_id = :invoice_id ORDER BY payment_date DESC");
        $this->db->bind(':invoice_id', $invoiceId);
        return $this->db->resultSet();
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO invoices (
                invoice_no, order_id, location_id, customer_id, billing_address, shipping_address, issue_date, due_date, 
                subtotal, tax_total, discount_total, grand_total, notes, created_by, updated_by
            ) VALUES (
                :invoice_no, :order_id, :location_id, :customer_id, :billing_address, :shipping_address, :issue_date, :due_date, 
                :subtotal, :tax_total, :discount_total, :grand_total, :notes, :created_by, :updated_by
            )
        ");
        $this->db->bind(':invoice_no', $data['invoice_no']);
        $this->db->bind(':order_id', $data['order_id'] ?? null);
        $this->db->bind(':location_id', $data['location_id'] ?? null);
        $this->db->bind(':customer_id', $data['customer_id']);
        $this->db->bind(':billing_address', $data['billing_address'] ?? null);
        $this->db->bind(':shipping_address', $data['shipping_address'] ?? null);
        $this->db->bind(':issue_date', $data['issue_date']);
        $this->db->bind(':due_date', $data['due_date'] ?? null);
        $this->db->bind(':subtotal', $data['subtotal']);
        $this->db->bind(':tax_total', $data['tax_total']);
        $this->db->bind(':discount_total', $data['discount_total'] ?? 0);
        $this->db->bind(':grand_total', $data['grand_total']);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':created_by', $data['userId']);
        $this->db->bind(':updated_by', $data['userId']);

        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function addItems($invoiceId, $items) {
        foreach ($items as $item) {
            $this->db->query("
                INSERT INTO invoice_items (
                    invoice_id, item_id, description, item_type, quantity, unit_price, discount, line_total
                ) VALUES (
                    :invoice_id, :item_id, :description, :item_type, :quantity, :unit_price, :discount, :line_total
                )
            ");
            $this->db->bind(':invoice_id', $invoiceId);
            $this->db->bind(':item_id', isset($item['item_id']) && $item['item_id'] ? $item['item_id'] : null);
            $this->db->description = $item['description'] ?? 'Item';
            $this->db->bind(':description', $item['description']);
            $this->db->bind(':item_type', $item['item_type'] ?? 'Part');
            $this->db->bind(':quantity', $item['quantity']);
            $this->db->bind(':unit_price', $item['unit_price']);
            $this->db->bind(':discount', $item['discount'] ?? 0);
            $this->db->bind(':line_total', $item['line_total']);
            $this->db->execute();
        }
        return true;
    }

    public function addAppliedTaxes($invoiceId, $taxes) {
        if (!is_array($taxes) || empty($taxes)) return true;
        foreach ($taxes as $tax) {
            $this->db->query("
                INSERT INTO invoice_taxes (invoice_id, tax_name, tax_code, rate_percent, amount)
                VALUES (:invoice_id, :name, :code, :rate, :amount)
            ");
            $this->db->bind(':invoice_id', $invoiceId);
            $this->db->bind(':name', $tax['name']);
            $this->db->bind(':code', $tax['code']);
            $this->db->bind(':rate', $tax['amount'] > 0 ? ($tax['rate_percent'] ?? 0) : 0);
            $this->db->bind(':amount', $tax['amount']);
            $this->db->execute();
        }
        return true;
    }

    public function getAppliedTaxes($invoiceId) {
        $this->db->query("SELECT * FROM invoice_taxes WHERE invoice_id = :invoice_id ORDER BY id ASC");
        $this->db->bind(':invoice_id', $invoiceId);
        return $this->db->resultSet();
    }

    public function addPayment($invoiceId, $data) {
        $this->db->query("
            INSERT INTO invoice_payments (
                invoice_id, amount, payment_date, payment_method, reference_no, notes, created_by
            ) VALUES (
                :invoice_id, :amount, :payment_date, :payment_method, :reference_no, :notes, :created_by
            )
        ");
        $this->db->bind(':invoice_id', $invoiceId);
        $this->db->bind(':amount', $data['amount']);
        $this->db->bind(':payment_date', $data['payment_date']);
        $this->db->bind(':payment_method', $data['payment_method'] ?? 'Cash');
        $this->db->bind(':reference_no', $data['reference_no'] ?? null);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':created_by', $data['userId']);

        if ($this->db->execute()) {
            $this->updatePaidStatus($invoiceId);
            return true;
        }
        return false;
    }

    private function updatePaidStatus($invoiceId) {
        // Calculate total paid
        $this->db->query("SELECT SUM(amount) as total_paid FROM invoice_payments WHERE invoice_id = :invoice_id");
        $this->db->bind(':invoice_id', $invoiceId);
        $row = $this->db->single(); $totalPaid = $row ? ($row->total_paid ?? 0) : 0;

        // Get grand total
        $this->db->query("SELECT grand_total FROM invoices WHERE id = :id");
        $this->db->bind(':id', $invoiceId);
        $inv = $this->db->single(); $grandTotal = $inv ? $inv->grand_total : 0;

        $status = 'Unpaid';
        if ($totalPaid >= $grandTotal) {
            $status = 'Paid';
        } elseif ($totalPaid > 0) {
            $status = 'Partial';
        }

        $this->db->query("UPDATE invoices SET paid_amount = :paid, status = :status WHERE id = :id");
        $this->db->bind(':paid', $totalPaid);
        $this->db->bind(':status', $status);
        $this->db->bind(':id', $invoiceId);
        $this->db->execute();
    }
}
