<?php
use Dompdf\Dompdf;
use Dompdf\Options;

class PdfHelper {
    
    /**
     * Generate a PDF for an invoice
     * @param object $invoice Invoice object with items and company details
     * @return string Absolute path to the generated PDF
     */
    public static function generateInvoice($invoice, $company) {
        require_once __DIR__ . '/../../vendor/autoload.php';

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        $dompdf = new Dompdf($options);

        $html = self::getInvoiceHtml($invoice, $company);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $output = $dompdf->output();
        $tempDir = __DIR__ . '/../../public/temp';
        if (!file_exists($tempDir)) mkdir($tempDir, 0777, true);
        
        $fileName = 'INV_' . $invoice->invoice_no . '_' . time() . '.pdf';
        $filePath = $tempDir . '/' . $fileName;
        file_put_contents($filePath, $output);

        return $filePath;
    }

    private static function getInvoiceHtml($invoice, $company) {
        $itemsHtml = "";
        foreach ($invoice->items as $item) {
            $itemsHtml .= "
                <tr>
                    <td style='padding: 15px 0; border-bottom: 1px solid #f1f5f9;'>
                        <div style='font-weight: 700; color: #0f172a; text-transform: uppercase; font-size: 13px;'>{$item->description}</div>
                        <div style='font-size: 11px; color: #64748b; margin-top: 2px;'>" . ($item->item_type ?? 'SERVICE') . "</div>
                    </td>
                    <td style='padding: 15px 0; border-bottom: 1px solid #f1f5f9; text-align: center; color: #0f172a; font-weight: 600;'>{$item->quantity}</td>
                    <td style='padding: 15px 0; border-bottom: 1px solid #f1f5f9; text-align: right; color: #0f172a;'>LKR " . number_format($item->unit_price, 2) . "</td>
                    <td style='padding: 15px 0; border-bottom: 1px solid #f1f5f9; text-align: right; color: #e11d48;'>- LKR " . number_format($item->discount ?? 0, 2) . "</td>
                    <td style='padding: 15px 0; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: #0f172a;'>LKR " . number_format($item->line_total, 2) . "</td>
                </tr>
            ";
        }

        $taxRows = "";
        if (!empty($invoice->applied_taxes)) {
            foreach ($invoice->applied_taxes as $tax) {
                $taxRows .= "
                    <tr>
                        <td style='text-align: right; padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase;'>{$tax->tax_code} (" . ($tax->rate_percent ?? 0) . "%):</td>
                        <td style='text-align: right; padding: 5px 0 5px 40px; color: #0f172a; font-weight: 700;'>LKR " . number_format($tax->amount, 2) . "</td>
                    </tr>
                ";
            }
        }

        $paidAmount = $invoice->paid_amount ?? 0;
        $balance = $invoice->grand_total - $paidAmount;
        $statusColor = $invoice->status === 'Paid' ? '#dcfce7' : ($invoice->status === 'Partial' ? '#fef9c3' : '#fee2e2');
        $statusTextColor = $invoice->status === 'Paid' ? '#166534' : ($invoice->status === 'Partial' ? '#854d0e' : '#991b1b');

        return "
        <html>
        <head>
            <style>
                @page { margin: 40px; }
                * { font-family: 'Helvetica', 'Arial', sans-serif; }
                body { color: #1a1a1a; font-size: 12px; line-height: 1.4; }
                .header { margin-bottom: 50px; }
                .invoice-label { font-size: 32px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: -1px; }
                .invoice-no { font-size: 12px; color: #94a3b8; font-weight: 700; margin-top: -5px; }
                .company-name { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                .company-details { text-align: right; color: #64748b; font-size: 11px; line-height: 1.3; }
                
                .billing-section { margin-bottom: 40px; }
                .section-title { font-size: 10px; font-weight: 800; color: #3b82f6; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
                
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .items-table th { text-align: left; padding-bottom: 10px; border-bottom: 2px solid #0f172a; font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; }
                
                .summary-container { margin-left: auto; width: 350px; }
                .summary-table { width: 100%; border-collapse: collapse; }
                .grand-total-label { font-size: 18px; font-weight: 800; color: #0f172a; text-transform: uppercase; padding: 15px 0; }
                .grand-total-value { font-size: 24px; font-weight: 800; color: #0f172a; text-align: right; padding: 15px 0; }
                
                .payment-box { background-color: #f8fafc; border-radius: 12px; padding: 20px; margin-top: 10px; }
                .payment-row { display: table; width: 100%; margin-bottom: 5px; }
                .payment-label { display: table-cell; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
                .payment-value { display: table-cell; text-align: right; font-weight: 700; color: #0f172a; }
                .balance-due { font-size: 16px; color: #2563eb; }

                .status-badge { display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; background-color: {$statusColor}; color: {$statusTextColor}; margin-top: 10px; }
                
                .notes-section { margin-top: 60px; }
                .footer { margin-top: 80px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                .footer-text { font-size: 10px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }
            </style>
        </head>
        <body>
            <div class='header'>
                <table style='width: 100%;'>
                    <tr>
                        <td style='vertical-align: top;'>
                            <div class='invoice-label'>Invoice</div>
                            <div class='invoice-no'>NO : {$invoice->invoice_no}</div>
                        </td>
                        <td class='company-details'>
                            <div class='company-name'>{$company->name}</div>
                            <div>Peak view Service Center</div>
                            <div>" . ($company->address ?? '') . "</div>
                            <div>" . ($company->phone ?? '') . "</div>
                            " . (isset($company->vat_no) ? "<div>VAT REG NO: {$company->vat_no}</div>" : "") . "
                            <div>" . ($company->email ?? '') . "</div>
                        </td>
                    </tr>
                </table>
            </div>

            <div class='billing-section'>
                <table style='width: 100%;'>
                    <tr>
                        <td style='width: 50%; vertical-align: top;'>
                            <div class='section-title'>Billed To</div>
                            <div style='font-size: 16px; font-weight: 800; color: #0f172a;'>{$invoice->customer_name}</div>
                            <div style='font-weight: 600; color: #0f172a; margin-top: 2px;'>{$invoice->customer_phone}</div>
                        </td>
                        <td style='text-align: right; vertical-align: top;'>
                            <table style='margin-left: auto;'>
                                <tr>
                                    <td style='text-align: right; padding-right: 20px; color: #64748b; font-weight: 600;'>Issue Date</td>
                                    <td style='text-align: right; font-weight: 700; color: #0f172a;'>" . date('d/m/Y, h:i a', strtotime($invoice->issue_date)) . "</td>
                                </tr>
                                <tr>
                                    <td style='text-align: right; padding-right: 20px; color: #64748b; font-weight: 600;'>Due Date</td>
                                    <td style='text-align: right; font-weight: 700; color: #0f172a;'>" . ($invoice->due_date ? date('d/m/Y', strtotime($invoice->due_date)) : '-') . "</td>
                                </tr>
                            </table>
                            <div class='status-badge'>{$invoice->status}</div>
                        </td>
                    </tr>
                </table>
            </div>

            <table class='items-table'>
                <thead>
                    <tr>
                        <th style='width: 50%;'>Description & Details</th>
                        <th style='text-align: center;'>Qty</th>
                        <th style='text-align: right;'>Unit Price</th>
                        <th style='text-align: right;'>Discount</th>
                        <th style='text-align: right;'>Line Total</th>
                    </tr>
                </thead>
                <tbody>
                    {$itemsHtml}
                </tbody>
            </table>

            <div class='summary-container'>
                <table class='summary-table'>
                    <tr>
                        <td style='text-align: right; padding: 5px 0; color: #64748b; font-weight: 600; font-size: 12px; text-transform: uppercase;'>Subtotal:</td>
                        <td style='text-align: right; padding: 5px 0 5px 40px; color: #0f172a; font-weight: 700;'>LKR " . number_format($invoice->subtotal, 2) . "</td>
                    </tr>
                    {$taxRows}
                    <tr>
                        <td class='grand-total-label'>Grand Total</td>
                        <td class='grand-total-value'>LKR " . number_format($invoice->grand_total, 2) . "</td>
                    </tr>
                </table>

                <div class='payment-box'>
                    <div class='payment-row'>
                        <span class='payment-label'>Paid Amount</span>
                        <span class='payment-value'>LKR " . number_format($paidAmount, 2) . "</span>
                    </div>
                    <div class='payment-row' style='margin-top: 10px;'>
                        <span class='payment-label' style='color: #0f172a; font-size: 12px;'>Balance Due</span>
                        <span class='payment-value balance-due'>" . ($balance < 0 ? '-' : '') . "LKR " . number_format(abs($balance), 2) . "</span>
                    </div>
                </div>
            </div>

            <div class='notes-section'>
                <div class='section-title' style='color: #0f172a;'>Notes & Terms</div>
                <div style='color: #64748b; font-size: 11px; max-width: 400px;'>{$invoice->notes}</div>
            </div>

            <div class='footer'>
                <div class='footer-text'>&copy; {$company->name} • Automotive Excellence</div>
                <div style='font-size: 9px; color: #cbd5e1; margin-top: 8px;'>Thank you for your business. Please make payments to \"{$company->name}\" within the due date to avoid interest charges.</div>
            </div>
        </body>
        </html>
        ";
    }
}
