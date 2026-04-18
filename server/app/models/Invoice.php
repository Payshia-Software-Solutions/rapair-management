<?php
/**
 * Invoice Model
 */
class Invoice extends Model {
    private $table = 'invoices';
    private $db_ref;

    public function __construct() {
        $this->db_ref = new Database();
        $this->db = $this->db_ref;
    }

    public function ensureSchema() {
        require_once '../app/helpers/InvoiceSchema.php';
        InvoiceSchema::ensure();
        
        // Custom column check for order_type (legacy support)
        try {
            $this->db->query("SELECT order_type FROM invoices LIMIT 1");
            $this->db->execute();
        } catch (Exception $e) {
            $this->db->query("ALTER TABLE invoices ADD COLUMN order_type VARCHAR(20) DEFAULT 'retail' AFTER grand_total");
            $this->db->execute();
        }
    }

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
                   sl.tax_no as location_tax_no, sl.tax_label as location_tax_label,
                   rt.name as table_name, u.name as steward_name
            FROM invoices i
            JOIN customers c ON i.customer_id = c.id
            LEFT JOIN repair_orders ro ON i.order_id = ro.id
            LEFT JOIN service_locations sl ON i.location_id = sl.id
            LEFT JOIN restaurant_tables rt ON i.table_id = rt.id
            LEFT JOIN users u ON i.steward_id = u.id
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
                subtotal, tax_total, discount_total, grand_total, order_type, table_id, steward_id, notes, created_by, updated_by
            ) VALUES (
                :invoice_no, :order_id, :location_id, :customer_id, :billing_address, :shipping_address, :issue_date, :due_date, 
                :subtotal, :tax_total, :discount_total, :grand_total, :order_type, :table_id, :steward_id, :notes, :created_by, :updated_by
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
        $this->db->bind(':order_type', $data['order_type'] ?? 'retail');
        $this->db->bind(':table_id', $data['table_id'] ?? null);
        $this->db->bind(':steward_id', $data['steward_id'] ?? null);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':created_by', $data['userId']);
        $this->db->bind(':updated_by', $data['userId']);

        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function addItems($invoiceId, $items) {
        require_once 'Part.php';
        $partModel = new Part();

        // Fetch invoice to check if we should deduct stock (Only if order_id is NULL)
        $this->db->query("SELECT id, order_id, location_id FROM invoices WHERE id = :id");
        $this->db->bind(':id', $invoiceId);
        $inv = $this->db->single();
        $shouldDeduct = ($inv && empty($inv->order_id));
        $locationId = $inv ? $inv->location_id : 1;

        require_once 'InventoryBatch.php';
        $batchModel = new InventoryBatch();

        foreach ($items as $item) {
            $costPrice = 0;
            $pid = !empty($item['item_id']) ? (int)$item['item_id'] : null;
            $isPart = (($item['item_type'] ?? 'Part') === 'Part' && $pid);

            if ($isPart) {
                $part = $partModel->getById($pid);
                if ($part) {
                    $costPrice = (float)$part->cost_price;
                    
                    if ($shouldDeduct) {
                        $qty = (float)$item['quantity'];
                        $isFifo = (int)($part->is_fifo ?? 0) === 1 || (int)($part->is_expiry ?? 0) === 1;

                        if ($isFifo) {
                            $providedBatches = !empty($item['selected_batches']) && is_array($item['selected_batches']) ? $item['selected_batches'] : null;
                            
                            $deductions = [];
                            if ($providedBatches) {
                                foreach ($providedBatches as $pb) {
                                    $deductions[] = [
                                        'batch_id' => $pb['batch_id'] > 0 ? $pb['batch_id'] : null,
                                        'qty_deducted' => (float)$pb['qty']
                                    ];
                                }
                            } else {
                                $deductions = $batchModel->deductStockFIFO($pid, $locationId, $qty);
                            }

                            foreach ($deductions as $d) {
                                // Record movement per batch
                                $this->db->query("
                                    INSERT INTO stock_movements (location_id, part_id, batch_id, qty_change, movement_type, ref_table, ref_id, unit_cost, unit_price, notes)
                                    VALUES (:loc, :part_id, :batch_id, :qty_change, 'SALE', 'invoices', :ref_id, :unit_cost, :unit_price, :notes)
                                ");
                                $this->db->bind(':loc', $locationId);
                                $this->db->bind(':part_id', $pid);
                                $this->db->bind(':batch_id', $d['batch_id']);
                                $this->db->bind(':qty_change', -1 * $d['qty_deducted']);
                                $this->db->bind(':ref_id', $invoiceId);
                                $this->db->bind(':unit_cost', $costPrice);
                                $this->db->bind(':unit_price', (float)$item['unit_price']);
                                $this->db->bind(':notes', $providedBatches ? 'Retail Sale (Manual Batch)' : 'Retail Sale (Auto Batch)');
                                $this->db->execute();
                            }
                        } else {
                            // Standard movement
                            $this->db->query("
                                INSERT INTO stock_movements (location_id, part_id, qty_change, movement_type, ref_table, ref_id, unit_cost, unit_price, notes)
                                VALUES (:loc, :part_id, :qty_change, 'SALE', 'invoices', :ref_id, :unit_cost, :unit_price, :notes)
                            ");
                            $this->db->bind(':loc', $locationId);
                            $this->db->bind(':part_id', $pid);
                            $this->db->bind(':qty_change', -1 * $qty);
                            $this->db->bind(':ref_id', $invoiceId);
                            $this->db->bind(':unit_cost', $costPrice);
                            $this->db->bind(':unit_price', (float)$item['unit_price']);
                            $this->db->bind(':notes', 'Retail Sale');
                            $this->db->execute();
                        }

                        // Update global stock
                        $this->db->query("UPDATE parts SET stock_quantity = stock_quantity - :qty WHERE id = :pid");
                        $this->db->bind(':qty', $qty);
                        $this->db->bind(':pid', $pid);
                        $this->db->execute();
                    }
                }
            }

            $this->db->query("
                INSERT INTO invoice_items (
                    invoice_id, item_id, description, item_type, quantity, unit_price, cost_price, discount, line_total
                ) VALUES (
                    :invoice_id, :item_id, :description, :item_type, :quantity, :unit_price, :cost_price, :discount, :line_total
                )
            ");
            $this->db->bind(':invoice_id', $invoiceId);
            $this->db->bind(':item_id', $pid);
            $this->db->bind(':description', $item['description']);
            $this->db->bind(':item_type', $item['item_type'] ?? 'Part');
            $this->db->bind(':quantity', $item['quantity']);
            $this->db->bind(':unit_price', $item['unit_price']);
            $this->db->bind(':cost_price', $costPrice);
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

    public function getBatchMovements($invoiceId) {
        $this->db->query("
            SELECT sm.part_id, sm.batch_id, sm.qty_change, sm.notes,
                   b.batch_number, b.expiry_date
            FROM stock_movements sm
            LEFT JOIN inventory_batches b ON sm.batch_id = b.id
            WHERE sm.ref_table = 'invoices' AND sm.ref_id = :invoice_id
            ORDER BY sm.id ASC
        ");
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
            // Automated Accounting
            try {
                AccountingHelper::postPayment($invoiceId, $data);
            } catch (Exception $e) {
                error_log("Accounting post failed for Payment: " . $e->getMessage());
            }
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
