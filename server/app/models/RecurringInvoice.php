<?php
/**
 * Recurring Invoice Model
 */
class RecurringInvoice extends Model {
    private $table = 'recurring_invoices';

    public function getAll($filters = []) {
        $sql = "
            SELECT ri.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM recurring_invoices ri
            JOIN customers c ON ri.customer_id = c.id
            WHERE 1=1
        ";

        if (!empty($filters['status'])) {
            $sql .= " AND ri.status = :status";
        }
        if (!empty($filters['customer_id'])) {
            $sql .= " AND ri.customer_id = :customer_id";
        }

        $sql .= " ORDER BY ri.created_at DESC";

        $this->db->query($sql);
        if (!empty($filters['status'])) $this->db->bind(':status', $filters['status']);
        if (!empty($filters['customer_id'])) $this->db->bind(':customer_id', $filters['customer_id']);

        return $this->db->resultSet();
    }

    public function getById($id) {
        $this->db->query("
            SELECT ri.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM recurring_invoices ri
            JOIN customers c ON ri.customer_id = c.id
            WHERE ri.id = :id
        ");
        $this->db->bind(':id', $id);
        return $this->db->single();
    }

    public function getItems($templateId) {
        $this->db->query("SELECT * FROM recurring_invoice_items WHERE recurring_invoice_id = :template_id ORDER BY id ASC");
        $this->db->bind(':template_id', $templateId);
        return $this->db->resultSet();
    }

    public function getAppliedTaxes($templateId) {
        $this->db->query("SELECT * FROM recurring_invoice_taxes WHERE recurring_template_id = :template_id ORDER BY id ASC");
        $this->db->bind(':template_id', $templateId);
        return $this->db->resultSet();
    }

    public function addTaxes($templateId, $taxes) {
        foreach ($taxes as $tax) {
            $this->db->query("
                INSERT INTO recurring_invoice_taxes (recurring_template_id, tax_name, tax_code, rate_percent, amount)
                VALUES (:template_id, :tax_name, :tax_code, :rate_percent, :amount)
            ");
            $this->db->bind(':template_id', $templateId);
            $this->db->bind(':tax_name', $tax['tax_name']);
            $this->db->bind(':tax_code', $tax['tax_code']);
            $this->db->bind(':rate_percent', $tax['rate_percent']);
            $this->db->bind(':amount', $tax['amount']);
            $this->db->execute();
        }
    }

    public function create($data) {
        $this->db->query("
            INSERT INTO recurring_invoices (
                template_name, customer_id, location_id, frequency, start_date, end_date, next_generation_date, 
                billing_address, shipping_address, subtotal, tax_total, discount_total, shipping_fee, grand_total, 
                notes, created_by, updated_by
            ) VALUES (
                :template_name, :customer_id, :location_id, :frequency, :start_date, :end_date, :next_generation_date, 
                :billing_address, :shipping_address, :subtotal, :tax_total, :discount_total, :shipping_fee, :grand_total, 
                :notes, :created_by, :updated_by
            )
        ");
        $this->db->bind(':template_name', $data['template_name']);
        $this->db->bind(':customer_id', $data['customer_id']);
        $this->db->bind(':location_id', $data['location_id'] ?? null);
        $this->db->bind(':frequency', $data['frequency']);
        $this->db->bind(':start_date', $data['start_date']);
        $this->db->bind(':end_date', $data['end_date'] ?? null);
        $this->db->bind(':next_generation_date', $data['next_generation_date']);
        $this->db->bind(':billing_address', $data['billing_address'] ?? null);
        $this->db->bind(':shipping_address', $data['shipping_address'] ?? null);
        $this->db->bind(':subtotal', $data['subtotal']);
        $this->db->bind(':tax_total', $data['tax_total']);
        $this->db->bind(':discount_total', $data['discount_total'] ?? 0);
        $this->db->bind(':shipping_fee', $data['shipping_fee'] ?? 0);
        $this->db->bind(':grand_total', $data['grand_total']);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':created_by', $data['userId']);
        $this->db->bind(':updated_by', $data['userId']);

        if ($this->db->execute()) {
            return $this->db->lastInsertId();
        }
        return false;
    }

    public function addItems($templateId, $items) {
        foreach ($items as $item) {
            $this->db->query("
                INSERT INTO recurring_invoice_items (
                    recurring_invoice_id, item_id, description, item_type, quantity, unit_price, discount, line_total
                ) VALUES (
                    :template_id, :item_id, :description, :item_type, :quantity, :unit_price, :discount, :line_total
                )
            ");
            $this->db->bind(':template_id', $templateId);
            $this->db->bind(':item_id', !empty($item['item_id']) ? $item['item_id'] : null);
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

    public function update($id, $data) {
        $this->db->query("
            UPDATE recurring_invoices SET 
                template_name = :template_name,
                frequency = :frequency,
                start_date = :start_date,
                end_date = :end_date,
                next_generation_date = :next_generation_date,
                status = :status,
                billing_address = :billing_address,
                shipping_address = :shipping_address,
                subtotal = :subtotal,
                tax_total = :tax_total,
                discount_total = :discount_total,
                shipping_fee = :shipping_fee,
                grand_total = :grand_total,
                notes = :notes,
                updated_by = :updated_by
            WHERE id = :id
        ");
        $this->db->bind(':template_name', $data['template_name']);
        $this->db->bind(':frequency', $data['frequency']);
        $this->db->bind(':start_date', $data['start_date']);
        $this->db->bind(':end_date', $data['end_date'] ?? null);
        $this->db->bind(':next_generation_date', $data['next_generation_date']);
        $this->db->bind(':status', $data['status']);
        $this->db->bind(':billing_address', $data['billing_address'] ?? null);
        $this->db->bind(':shipping_address', $data['shipping_address'] ?? null);
        $this->db->bind(':subtotal', $data['subtotal']);
        $this->db->bind(':tax_total', $data['tax_total']);
        $this->db->bind(':discount_total', $data['discount_total'] ?? 0);
        $this->db->bind(':shipping_fee', $data['shipping_fee'] ?? 0);
        $this->db->bind(':grand_total', $data['grand_total']);
        $this->db->bind(':notes', $data['notes'] ?? null);
        $this->db->bind(':updated_by', $data['userId']);
        $this->db->bind(':id', $id);

        if ($this->db->execute()) {
            // Delete old items and add new ones
            $this->db->query("DELETE FROM recurring_invoice_items WHERE recurring_invoice_id = :id");
            $this->db->bind(':id', $id);
            $this->db->execute();
            $this->addItems($id, $data['items']);
            return true;
        }
        return false;
    }

    public function generateDueInvoices($userId) {
        $today = date('Y-m-d');
        $this->db->query("
            SELECT * FROM recurring_invoices 
            WHERE status = 'Active' 
            AND next_generation_date <= :today
            AND (end_date IS NULL OR end_date >= :today)
        ");
        $this->db->bind(':today', $today);
        $dueTemplates = $this->db->resultSet();

        $generatedCount = 0;
        $invoiceModel = new Invoice();

        foreach ($dueTemplates as $template) {
            $items = $this->getItems($template->id);
            
            // Format items for Invoice Model
            $invoiceItems = [];
            foreach ($items as $item) {
                $description = $item->description;
                // Replace placeholders based on the generation date
                $genDate = $template->next_generation_date;
                $replacements = [
                    '{month}' => date('F', strtotime($genDate)),
                    '{year}' => date('Y', strtotime($genDate)),
                    '{week}' => date('W', strtotime($genDate)),
                    '{day}' => date('d', strtotime($genDate)),
                    '{short_month}' => date('M', strtotime($genDate)),
                ];
                $description = strtr($description, $replacements);

                $invoiceItems[] = [
                    'item_id' => $item->item_id,
                    'description' => $description,
                    'item_type' => $item->item_type,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'discount' => $item->discount,
                    'line_total' => $item->line_total
                ];
            }

            // Generate Invoice Number
            $invoiceNo = DocumentSequenceHelper::getNext('INV');

            // Calculate Billing Period
            $genDate = $template->next_generation_date;
            $periodStart = date('d/m/Y', strtotime($genDate));
            $periodEnd = "";
            
            $dt = new DateTime($genDate);
            switch ($template->frequency) {
                case 'Daily':
                    $periodEnd = $periodStart;
                    break;
                case 'Weekly':
                    $dt->modify('+6 days');
                    $periodEnd = $dt->format('d/m/Y');
                    break;
                case 'Monthly':
                    $dt->modify('+1 month -1 day');
                    $periodEnd = $dt->format('d/m/Y');
                    break;
                case 'Yearly':
                    $dt->modify('+1 year -1 day');
                    $periodEnd = $dt->format('d/m/Y');
                    break;
            }
            
            $periodNote = "Billing Period: {$periodStart} to {$periodEnd}";
            $dueDate = date('Y-m-d', strtotime($genDate . ' +7 days'));

            $invoiceData = [
                'invoice_no' => $invoiceNo,
                'customer_id' => $template->customer_id,
                'location_id' => $template->location_id,
                'billing_address' => $template->billing_address,
                'shipping_address' => $template->shipping_address,
                'issue_date' => $genDate,
                'due_date' => $dueDate, 
                'subtotal' => $template->subtotal,
                'tax_total' => $template->tax_total,
                'discount_total' => $template->discount_total,
                'shipping_fee' => $template->shipping_fee,
                'grand_total' => $template->grand_total,
                'notes' => ($template->notes ? $template->notes . "\n" : "") . $periodNote,
                'userId' => $userId,
                'recurring_template_id' => $template->id
            ];

            $this->db->beginTransaction();
            try {
                $invoiceId = $invoiceModel->create($invoiceData);
                if ($invoiceId) {
                    // Manually update recurring_template_id since it might not be in create() yet
                    $this->db->query("UPDATE invoices SET recurring_template_id = :tid WHERE id = :id");
                    $this->db->bind(':tid', $template->id);
                    $this->db->bind(':id', $invoiceId);
                    $this->db->execute();

                    $invoiceModel->addItems($invoiceId, $invoiceItems, $userId);
                    
                    // Update Template next generation date
                    $nextDate = $this->calculateNextDate($template->next_generation_date, $template->frequency);
                    
                    $this->db->query("
                        UPDATE recurring_invoices 
                        SET next_generation_date = :next_date,
                            last_generation_date = :today
                        WHERE id = :id
                    ");
                    $this->db->bind(':next_date', $nextDate);
                    $this->db->bind(':today', $today);
                    $this->db->bind(':id', $template->id);
                    $this->db->execute();

                    // Send Email to Customer
                    $this->db->query("SELECT email, name FROM customers WHERE id = :cid LIMIT 1");
                    $this->db->bind(':cid', $template->customer_id);
                    $cust = $this->db->single();
                    
                    if ($cust && !empty($cust->email)) {
                        require_once __DIR__ . '/../helpers/EmailHelper.php';
                        require_once __DIR__ . '/../helpers/PdfHelper.php';
                        require_once __DIR__ . '/../models/SystemSetting.php';

                        $settingModel = new SystemSetting();
                        $company = (object)$settingModel->getAll();
                        $company->name = $company->mail_from_name ?? 'BizFlow Solutions';

                        // Prepare object for PDF generator
                        $templateArray = (array)$template;
                        $templateArray['invoice_no'] = $invoiceNo;
                        $templateArray['issue_date'] = $genDate;
                        $templateArray['due_date'] = $dueDate;
                        $templateArray['status'] = 'Unpaid';
                        $templateArray['items'] = $template->items;
                        $templateArray['applied_taxes'] = $this->getAppliedTaxes($template->id); // Note: this uses template taxes
                        $templateObj = (object)$templateArray;

                        $pdfPath = PdfHelper::generateInvoice($templateObj, $company);

                        $subject = "New Invoice Generated: " . $invoiceNo;
                        $amountFormatted = number_format($template->grand_total, 2);
                        
                        $message = "
                            <h2>Hello {$cust->name},</h2>
                            <p>A new invoice has been automatically generated for your recurring service. Please find the attached PDF for your records.</p>
                            
                            <div class='info-card'>
                                <div class='info-row'>
                                    <span class='label'>Invoice Number</span>
                                    <span class='value'>{$invoiceNo}</span>
                                </div>
                                <div class='info-row'>
                                    <span class='label'>Issue Date</span>
                                    <span class='value'>" . date('d M Y', strtotime($genDate)) . "</span>
                                </div>
                                <div class='info-row'>
                                    <span class='label'>Due Date</span>
                                    <span class='value' style='font-weight: bold; color: #e11d48;'>" . date('d M Y', strtotime($dueDate)) . "</span>
                                </div>
                                <div class='info-row'>
                                    <span class='label'>Billing Period</span>
                                    <span class='value'>{$periodStart} to {$periodEnd}</span>
                                </div>
                                <div class='info-row'>
                                    <span class='label'>Amount Due</span>
                                    <span class='value'>LKR {$amountFormatted}</span>
                                </div>
                                <div class='info-row'>
                                    <span class='label'>Payment Status</span>
                                    <span class='value' style='color: #e11d48;'>Unpaid</span>
                                </div>
                            </div>

                            <p>You can view and settle your invoices through our secure customer portal.</p>
                            
                            <div style='text-align: center;'>
                                <a href='" . (defined('URLROOT') ? URLROOT : '#') . "' class='btn'>Customer Portal</a>
                            </div>

                            <p style='margin-top: 32px;'>Thank you for your continued business!</p>
                        ";
                        EmailHelper::send($cust->email, $subject, $message, [$pdfPath]);

                        if (file_exists($pdfPath)) {
                            @unlink($pdfPath);
                        }
                    }

                    $this->db->commit();
                    $generatedCount++;
                } else {
                    $this->db->rollBack();
                }
            } catch (Exception $e) {
                $this->db->rollBack();
                error_log("Failed to generate recurring invoice for template " . $template->id . ": " . $e->getMessage());
            }
        }

        return $generatedCount;
    }

    private function calculateNextDate($currentDate, $frequency) {
        $date = new DateTime($currentDate);
        switch ($frequency) {
            case 'Daily':
                $date->modify('+1 day');
                break;
            case 'Weekly':
                $date->modify('+1 week');
                break;
            case 'Monthly':
                $date->modify('+1 month');
                break;
            case 'Yearly':
                $date->modify('+1 year');
                break;
        }
        return $date->format('Y-m-d');
    }

    /**
     * Force generate an invoice for a specific template immediately
     */
    public function forceGenerate($templateId, $userId) {
        $template = $this->getById($templateId);
        if (!$template) {
            return false;
        }

        $template->items = $this->getItems($templateId);
        
        $db = new Database();
        $db->beginTransaction();
        
        try {
            $invoiceNo = DocumentSequenceHelper::getNext('INV');
            
            // Calculate Billing Period (for today)
            $genDate = date('Y-m-d');
            $periodStart = date('d/m/Y', strtotime($genDate));
            $periodEnd = "";
            $dt = new DateTime($genDate);
            switch ($template->frequency) {
                case 'Daily': $periodEnd = $periodStart; break;
                case 'Weekly': $dt->modify('+6 days'); $periodEnd = $dt->format('d/m/Y'); break;
                case 'Monthly': $dt->modify('+1 month -1 day'); $periodEnd = $dt->format('d/m/Y'); break;
                case 'Yearly': $dt->modify('+1 year -1 day'); $periodEnd = $dt->format('d/m/Y'); break;
            }
            $periodNote = "Billing Period: {$periodStart} to {$periodEnd}";
            $dueDate = date('Y-m-d', strtotime($genDate . ' +7 days'));

            $invoiceData = [
                'invoice_no' => $invoiceNo,
                'customer_id' => $template->customer_id,
                'location_id' => $template->location_id,
                'billing_address' => $template->billing_address,
                'shipping_address' => $template->shipping_address,
                'issue_date' => $genDate,
                'due_date' => $dueDate,
                'subtotal' => $template->subtotal,
                'tax_total' => $template->tax_total,
                'discount_total' => $template->discount_total,
                'shipping_fee' => $template->shipping_fee,
                'grand_total' => $template->grand_total,
                'notes' => ($template->notes ? $template->notes . "\n" : "") . $periodNote . " (FORCE GENERATED)",
                'userId' => $userId,
                'recurring_template_id' => $template->id
            ];

            // Create Invoice
            $db->query("
                INSERT INTO invoices (
                    invoice_no, customer_id, location_id, billing_address, shipping_address,
                    issue_date, due_date, subtotal, tax_total, discount_total, shipping_fee,
                    grand_total, notes, created_by, status
                ) VALUES (
                    :invoice_no, :customer_id, :location_id, :billing_address, :shipping_address,
                    :issue_date, :due_date, :subtotal, :tax_total, :discount_total, :shipping_fee,
                    :grand_total, :notes, :userId, 'Unpaid'
                )
            ");
            $db->bind(':invoice_no', $invoiceData['invoice_no']);
            $db->bind(':customer_id', $invoiceData['customer_id']);
            $db->bind(':location_id', $invoiceData['location_id']);
            $db->bind(':billing_address', $invoiceData['billing_address']);
            $db->bind(':shipping_address', $invoiceData['shipping_address']);
            $db->bind(':issue_date', $invoiceData['issue_date']);
            $db->bind(':due_date', $invoiceData['due_date']);
            $db->bind(':subtotal', $invoiceData['subtotal']);
            $db->bind(':tax_total', $invoiceData['tax_total']);
            $db->bind(':discount_total', $invoiceData['discount_total']);
            $db->bind(':shipping_fee', $invoiceData['shipping_fee']);
            $db->bind(':grand_total', $invoiceData['grand_total']);
            $db->bind(':notes', $invoiceData['notes']);
            $db->bind(':userId', $invoiceData['userId']);
            $db->execute();
            $invoiceId = $db->lastInsertId();

            // Add Items
            foreach ($template->items as $item) {
                // Placeholder replacement
                $desc = $item->description;
                $desc = str_replace('{month}', date('F', strtotime($genDate)), $desc);
                $desc = str_replace('{year}', date('Y', strtotime($genDate)), $desc);
                $desc = str_replace('{week}', date('W', strtotime($genDate)), $desc);
                $desc = str_replace('{date}', date('d/m/Y', strtotime($genDate)), $desc);

                $db->query("
                    INSERT INTO invoice_items (invoice_id, item_id, description, item_type, quantity, unit_price, discount, line_total)
                    VALUES (:invoice_id, :item_id, :description, :item_type, :quantity, :unit_price, :discount, :line_total)
                ");
                $db->bind(':invoice_id', $invoiceId);
                $db->bind(':item_id', $item->item_id);
                $db->bind(':description', $desc);
                $db->bind(':item_type', $item->item_type);
                $db->bind(':quantity', $item->quantity);
                $db->bind(':unit_price', $item->unit_price);
                $db->bind(':discount', $item->discount);
                $db->bind(':line_total', $item->line_total);
                $db->execute();
            }

            // Sync Taxes
            $db->query("
                INSERT INTO invoice_taxes (invoice_id, tax_name, tax_code, rate_percent, amount)
                SELECT :invoice_id, tax_name, tax_code, rate_percent, amount 
                FROM recurring_invoice_taxes WHERE recurring_template_id = :template_id
            ");
            $db->bind(':invoice_id', $invoiceId);
            $db->bind(':template_id', $templateId);
            $db->execute();

            // Send Email to Customer
            $db->query("SELECT email, name FROM customers WHERE id = :cid LIMIT 1");
            $db->bind(':cid', $template->customer_id);
            $cust = $db->single();
            
            if ($cust && !empty($cust->email)) {
                require_once __DIR__ . '/../helpers/EmailHelper.php';
                require_once __DIR__ . '/../helpers/PdfHelper.php';
                require_once __DIR__ . '/../models/SystemSetting.php';

                $settingModel = new SystemSetting();
                $company = (object)$settingModel->getAll();
                $company->name = $company->mail_from_name ?? 'BizFlow Solutions';

                // Prepare object for PDF generator
                $templateArray = (array)$template;
                $templateArray['invoice_no'] = $invoiceNo;
                $templateArray['issue_date'] = $genDate;
                $templateArray['due_date'] = $dueDate;
                $templateArray['status'] = 'Unpaid';
                $templateArray['items'] = $template->items;
                $templateArray['applied_taxes'] = $this->getAppliedTaxes($template->id);
                $templateObj = (object)$templateArray;

                $pdfPath = PdfHelper::generateInvoice($templateObj, $company);

                $subject = "Invoice Manually Generated: " . $invoiceNo;
                $amountFormatted = number_format($template->grand_total, 2);
                
                $message = "
                    <h2>Hello {$cust->name},</h2>
                    <p>A new invoice has been manually triggered from your recurring template. Please find the attached PDF for your records.</p>
                    
                    <div class='info-card'>
                        <div class='info-row'>
                            <span class='label'>Invoice Number</span>
                            <span class='value'>{$invoiceNo}</span>
                        </div>
                        <div class='info-row'>
                            <span class='label'>Issue Date</span>
                            <span class='value'>" . date('d M Y', strtotime($genDate)) . "</span>
                        </div>
                        <div class='info-row'>
                            <span class='label'>Due Date</span>
                            <span class='value' style='font-weight: bold; color: #e11d48;'>" . date('d M Y', strtotime($dueDate)) . "</span>
                        </div>
                        <div class='info-row'>
                            <span class='label'>Billing Period</span>
                            <span class='value'>{$periodStart} to {$periodEnd}</span>
                        </div>
                        <div class='info-row'>
                            <span class='label'>Amount Due</span>
                            <span class='value'>LKR {$amountFormatted}</span>
                        </div>
                        <div class='info-row'>
                            <span class='label'>Payment Status</span>
                            <span class='value' style='color: #e11d48;'>Unpaid</span>
                        </div>
                    </div>

                    <p>You can view and settle your invoices through our secure customer portal.</p>
                    
                    <div style='text-align: center;'>
                        <a href='" . (defined('URLROOT') ? URLROOT : '#') . "' class='btn'>Customer Portal</a>
                    </div>

                    <p style='margin-top: 32px;'>Thank you for your business!</p>
                ";
                EmailHelper::send($cust->email, $subject, $message, [$pdfPath]);

                if (file_exists($pdfPath)) {
                    @unlink($pdfPath);
                }
            }

            $db->commit();
            return $invoiceId;
        } catch (Exception $e) {
            $db->rollBack();
            error_log("Force Generate Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
            return false;
        }
    }
}
