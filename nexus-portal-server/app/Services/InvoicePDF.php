<?php
namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

class InvoicePDF {
    public static function generate($data, $isReceipt = false) {
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false); // the logo is embedded as data, nothing else should load
        $options->set('defaultFont', 'DejaVu Sans');
        
        $dompdf = new Dompdf($options);
        
        $title = $isReceipt ? "RECEIPT" : "INVOICE";
        $color = $isReceipt ? "#10b981" : "#6366f1";
        $packageName = 'Custom Plan';
        if (isset($data->package_name) && !empty($data->package_name)) {
            $packageName = $data->package_name;
        }
        
        // Escape everything that came from the database or a form
        $e = function ($v) { return htmlspecialchars((string)($v ?? ''), ENT_QUOTES, 'UTF-8'); };
        $billingMonth = (string)($data->billing_month ?? '');
        $isAnnual = strpos($billingMonth, 'Annual') === 0;

        // Service period: a calendar month, or 12 months from the invoice date for annual plans
        $issued = strtotime($data->created_at ?? 'now') ?: time();
        if ($isAnnual) {
            $periodStart = date('M d, Y', $issued);
            $periodEnd = date('M d, Y', strtotime('+1 year -1 day', $issued));
        } else {
            $mt = \DateTime::createFromFormat('!F Y', $billingMonth);
            $monthTime = $mt ? $mt->getTimestamp() : $issued;
            $periodStart = date('M 01, Y', $monthTime);
            $periodEnd = date('M t, Y', $monthTime);
        }
        $amount = (float)($data->amount ?? 0);
        $paidTotal = (float)($data->paid_total ?? 0);
        $balance = isset($data->balance) ? (float)$data->balance : max(0, $amount - $paidTotal);
        $receiptAmount = (float)($data->payment_amount ?? $amount);
        $cur = $e($data->currency ?? 'USD');
        
        // Fetch Company Info from Settings
        $db = new \App\Core\Database();
        $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'company_%'");
        $settingsArr = $db->resultSet();
        $company = [];
        foreach ($settingsArr as $s) $company[$s->setting_key] = $s->setting_value;
        $company += ['company_name' => 'Nebulync Software Pvt Ltd', 'company_address' => '', 'company_email' => ''];

        // Logo Logic: 1. DB Setting, 2. User-uploaded local, 3. Requested URL Fallback
        $logoName = $company['company_logo'] ?? 'nebulync-logo.png';
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2);
        $logoPath = "";
        
        // Resolve path
        if (strpos($logoName, 'http') === 0) {
            $logoPath = $logoName;
        } elseif (strpos($logoName, 'ui/') === 0) {
            // Uploaded through the UI: use the file when it is on this server, else the UI URL
            $local = dirname(__DIR__, 3) . '/nexus-portal-ui/public/' . substr($logoName, 3);
            $logoPath = is_file($local) ? $local : rtrim(\App\Core\Config::SITE_URL(), '/') . '/' . substr($logoName, 3);
        } else {
            // Priority: Try DOCUMENT_ROOT first as discovered by debug script
            $logoPath = $docRoot . '/public/' . $logoName;
            
            // Fallback: If that fails, try relative to __DIR__
            if (!file_exists($logoPath)) {
                $logoPath = dirname(__DIR__, 2) . '/public/' . $logoName;
            }

            // Final Local Fallback: The specific file we know exists
            if (!file_exists($logoPath)) {
                $logoPath = $docRoot . '/public/nebulync-logo.png';
            }
        }

        $logoData = "";
        // dompdf needs the GD extension for images; without it the invoice still renders, just without the logo
        if (!empty($logoPath) && extension_loaded('gd')) {
            try {
                if (strpos($logoPath, 'http') !== 0) {
                    if (file_exists($logoPath)) {
                        $type = pathinfo($logoPath, PATHINFO_EXTENSION);
                        $imgData = file_get_contents($logoPath);
                        $logoData = 'data:image/' . $type . ';base64,' . base64_encode($imgData);
                    }
                } else {
                    // It's a URL fallback
                    $encodedPath = str_replace(' ', '%20', $logoPath);
                    // Short timeout: a slow or missing logo must never hold up an invoice
                    $ctx = stream_context_create(['http' => ['timeout' => 4], 'https' => ['timeout' => 4]]);
                    $imgData = @file_get_contents($encodedPath, false, $ctx);
                    if (!$imgData) {
                        $fallback = dirname(__DIR__, 2) . '/public/nebulync-logo.png';
                        $imgData = is_file($fallback) ? file_get_contents($fallback) : '';
                        $logoPath = $fallback;
                    }
                    
                    if ($imgData) {
                        $type = pathinfo($logoPath, PATHINFO_EXTENSION);
                        $logoData = 'data:image/' . $type . ';base64,' . base64_encode($imgData);
                    }
                }
            } catch (\Exception $e) {
                error_log("Logo Load Error: " . $e->getMessage());
            }
        }

        $html = "
        <html>
        <head>
            <style>
                html, body, table, td, th, div, span, b, strong, p { font-family: 'DejaVu Sans', sans-serif !important; }
                body { color: #1e293b; padding: 30px; margin: 0; }
                .header { margin-bottom: 40px; }
                .title { font-size: 28px; font-weight: bold; color: #000; text-transform: uppercase; letter-spacing: -0.02em; }
                .company-info { font-size: 11px; color: #64748b; line-height: 1.5; }
                .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                .table th { background: #f8fafc; padding: 15px; text-align: left; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; color: #475569; }
                .table td { padding: 15px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
                .total-box { background: #f8fafc; padding: 25px; border-radius: 16px; text-align: right; border: 1px solid #e2e8f0; }
                .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
                .badge { padding: 4px 12px; border-radius: 999px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class='header'>
                <table width='100%'>
                    <tr>
                        <td width='60%'>
                            " . ($logoData ? "<img src='{$logoData}' style='height: 35px; margin-bottom: 15px;' />" : "") . "
                            <div class='company-info'>
                                <strong>" . $e($company['company_name']) . "</strong><br>
                                " . nl2br($e($company['company_address'])) . "
                            </div>
                        </td>
                        <td align='right' valign='top'>
                            <div class='title'>{$title}</div>
                            " . ($isReceipt && isset($data->receipt_number) ? "
                            <div style='font-size: 14px; font-weight: bold; color: #10b981; margin-top: 5px;'>#" . $e($data->receipt_number) . "</div>
                            <div style='font-size: 11px; color: #64748b; margin-top: 3px;'>Ref Invoice: #" . $e($data->invoice_number) . "</div>
                            " : "
                            <div style='font-size: 14px; font-weight: bold; color: #6366f1; margin-top: 5px;'>#" . $e($data->invoice_number) . "</div>
                            ") . "
                            <div style='font-size: 11px; color: #94a3b8; margin-top: 5px;'>" . ($isReceipt ? "Paid Date" : "Issued") . ": " . date('M d, Y', strtotime($isReceipt ? ($data->paid_at ?? $data->created_at) : $data->created_at)) . "</div>
                        </td>
                    </tr>
                </table>
            </div>

            <hr style='border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 40px;' />

            <table width='100%' style='margin-bottom: 50px;'>
                <tr>
                    <td width='50%'>
                        <div style='font-size: 10px; font-weight: bold; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.05em;'>Client Information</div>
                        <div style='font-weight: bold; font-size: 18px; color: #000; margin-bottom: 4px;'>" . $e($data->tenant_name) . "</div>
                        <div style='font-size: 13px; color: #64748b; margin-bottom: 4px;'>" . $e($data->admin_email) . "</div>
                        <div style='font-size: 12px; color: #64748b; line-height: 1.4; max-width: 250px;'>" . nl2br($e($data->address ?? '')) . "</div>
                    </td>
                    <td align='right'>
                        <div style='font-size: 10px; font-weight: 900; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.05em;'>Payment Details</div>
                        " . ($isReceipt && isset($data->receipt_number) ? "
                        <div style='font-size: 13px; color: #1e293b; margin-bottom: 4px;'>Receipt #: <span style='font-weight: bold;'>" . $e($data->receipt_number) . "</span></div>
                        <div style='font-size: 13px; color: #1e293b; margin-bottom: 4px;'>Paid Date: <span style='font-weight: bold;'>".date('M d, Y', strtotime($data->paid_at ?? $data->created_at))."</span></div>
                        <div style='font-size: 13px; color: #1e293b; margin-bottom: 4px;'>Method: <span style='font-weight: bold;'>" . $e($data->payment_method ?? 'Bank Transfer') . "</span></div>
                        " . (!empty($data->transaction_id) ? "<div style='font-size: 11px; color: #64748b; margin-bottom: 4px;'>Reference: " . $e($data->transaction_id) . "</div>" : "") . "
                        " : "
                        <div style='font-size: 13px; color: #1e293b; margin-bottom: 4px;'>Due Date: <span style='font-weight: bold;'>".date('M d, Y', strtotime($data->due_date ?? 'now'))."</span></div>
                        <div style='font-size: 13px; margin-bottom: 4px;'>Status: <span class='badge' style='background: ".($data->status == 'Paid' ? '#ecfdf5' : '#fff7ed')."; color: ".($data->status == 'Paid' ? '#10b981' : '#f59e0b').";'>" . $e($data->status) . "</span></div>
                        ") . "
                        " . ($data->currency !== 'USD' ? "
                        <div style='font-size: 11px; color: #64748b; margin-top: 5px;'>
                            Billing Currency: <strong>{$cur}</strong><br>
                            Rate: 1 USD = " . number_format($data->exchange_rate ?? 1, 4) . "<br>
                            Source: " . $e($data->source ?? 'MARKET') . "
                        </div>" : "") . "
                    </td>
                </tr>
            </table>

            <table class='table'>
                " . ($isReceipt ? "
                <thead>
                    <tr>
                        <th width='70%'>Payment Information</th>
                        <th align='right'>Amount Paid</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div style='font-weight: bold; font-size: 14px;'>Payment for Subscription Invoice #" . $e($data->invoice_number) . "</div>
                            <div style='font-size: 11px; color: #64748b; margin-top: 6px;'>Service Period: " . $e($billingMonth) . "</div>
                            <div style='font-size: 11px; color: #64748b;'>Method: " . $e($data->payment_method ?? 'Bank Transfer') . "</div>
                            <div style='font-size: 11px; color: #64748b;'>Receipt Reference: " . $e($data->receipt_number ?? 'N/A') . "</div>
                        </td>
                        <td align='right' style='font-weight: bold; font-size: 18px; color: #10b981;'>{$cur} " . number_format($receiptAmount, 2) . "</td>
                    </tr>
                </tbody>
                " : "
                <thead>
                    <tr>
                        <th width='60%'>Description of Services</th>
                        <th align='center'>Period</th>
                        <th align='right'>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div style='font-weight: bold; font-size: 14px;'>" . $e($packageName) . "</div>
                            <div style='font-size: 11px; color: #64748b; margin-top: 6px;'>
                                " . ($isAnnual ? 'Annual' : 'Monthly') . " subscription fee.
                                " . (isset($data->base_price) ? "<br><strong>Plan price: USD " . number_format((float)$data->base_price, 2) . "</strong>" : "") . "
                            </div>
                            <div style='font-size: 11px; color: #64748b; margin-top: 4px;'>Service Interval: {$periodStart} — {$periodEnd}</div>
                        </td>
                        <td align='center' style='color: #64748b; font-weight: bold;'>" . $e($billingMonth) . "</td>
                        <td align='right' style='font-weight: bold; font-size: 15px;'>{$cur} " . number_format($amount, 2) . "</td>
                    </tr>
                </tbody>
                ") . "
            </table>

            <table width='100%'>
                <tr>
                    <td width='50%'>
                        <div style='font-size: 11px; color: #94a3b8; line-height: 1.6;'>
                            <strong>" . ($isReceipt ? "Acknowledgment:" : "Notes & Terms:") . "</strong><br>
                            " . ($isReceipt ? "Thank you for your prompt payment. Your subscription remains active and up to date." : "Please process payment within the due date to avoid service interruption.") . "<br>
                            For billing inquiries, contact " . $e($company['company_email'] ?: 'billing@nebulync.com') . ".
                        </div>
                    </td>
                    <td width='50%' align='right'>
                        <div class='total-box'>
                            <div style='font-size: 11px; font-weight: 900; text-transform: uppercase; color: #64748b; margin-bottom: 5px;'>" . ($isReceipt ? "Amount Paid" : ($paidTotal > 0 ? "Balance Due" : "Total Amount Due")) . "</div>
                            <div style='font-size: 32px; font-weight: 900; color: #000;'>{$cur} " . number_format($isReceipt ? $receiptAmount : ($paidTotal > 0 ? $balance : $amount), 2) . "</div>
                            " . ($paidTotal > 0 && ($balance > 0.005 || $receiptAmount + 0.005 < $amount) ? "<div style='font-size: 11px; color: #64748b; margin-top: 4px;'>Invoice total {$cur} " . number_format($amount, 2) . " &middot; Paid {$cur} " . number_format($paidTotal, 2) . " &middot; Balance {$cur} " . number_format($balance, 2) . "</div>" : "") . "
                            <div style='font-size: 11px; color: #94a3b8; margin-top: 5px;'>All prices are in {$cur}</div>
                            " . ($data->currency !== 'USD' ? "
                            <div style='margin-top: 10px; font-size: 10px; color: #64748b;'>
                                Rate: 1 USD = " . number_format((float)($data->exchange_rate ?? 1), 4) . " {$cur}<br>
                                Source: " . $e($data->source ?? 'MARKET') . "
                            </div>" : "") . "
                        </div>
                    </td>
                </tr>
            </table>

            <div class='footer'>
                <strong>" . $e($company['company_name']) . "</strong><br>
                This is an official document generated by BizzFlow Suite.<br>
                &copy; ".date('Y')." Nebulync. All rights reserved.
            </div>
        </body>
        </html>
        ";
        
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        
        return $dompdf->output();
    }
}
