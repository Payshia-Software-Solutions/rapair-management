<?php
namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

class InvoicePDF {
    public static function generate($data, $isReceipt = false) {
        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', true);
        
        $dompdf = new Dompdf($options);
        
        $title = $isReceipt ? "PAYMENT RECEIPT" : "TAX INVOICE";
        $color = $isReceipt ? "#10b981" : "#6366f1";
        $packageName = $data->package_name ?? 'Custom Plan';
        
        // Calculate Period Dates
        $monthTime = strtotime($data->billing_month);
        $periodStart = date('M 01, Y', $monthTime);
        $periodEnd = date('M t, Y', $monthTime);
        
        $html = "
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica', sans-serif; color: #1e293b; padding: 40px; }
                .header { border-bottom: 2px solid {$color}; padding-bottom: 20px; margin-bottom: 30px; }
                .title { font-size: 24px; font-weight: bold; color: {$color}; }
                .meta { display: flex; justify-content: space-between; margin-bottom: 40px; }
                .table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                .table th { background: #f8fafc; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
                .table td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
                .total-box { background: #f8fafc; padding: 20px; border-radius: 8px; text-align: right; }
                .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 100px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class='header'>
                <table width='100%'>
                    <tr>
                        <td><span class='title'>NEXUS PORTAL</span></td>
                        <td align='right'>
                            <div style='font-size: 18px; font-weight: bold;'>{$title}</div>
                            <div style='font-size: 12px; color: #64748b;'>#{$data->invoice_number}</div>
                        </td>
                    </tr>
                </table>
            </div>

            <table width='100%' style='margin-bottom: 40px;'>
                <tr>
                    <td width='50%'>
                        <div style='font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;'>Billed To</div>
                        <div style='font-weight: bold; font-size: 16px;'>{$data->tenant_name}</div>
                        <div style='font-size: 12px; color: #64748b;'>{$data->admin_email}</div>
                    </td>
                    <td align='right'>
                        <div style='font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;'>Date Issued</div>
                        <div style='font-weight: bold;'>".date('M d, Y', strtotime($data->created_at))."</div>
                        <div style='margin-top: 10px; font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;'>Due Date</div>
                        <div style='font-weight: bold;'>".date('M d, Y', strtotime($data->due_date))."</div>
                    </td>
                </tr>
            </table>

            <table class='table'>
                <thead>
                    <tr>
                        <th>Description</th>
                        <th align='center'>Billing Period</th>
                        <th align='right'>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>
                            <div style='font-weight: bold;'>Enterprise Subscription - {$packageName}</div>
                            <div style='font-size: 11px; color: #64748b; margin-top: 4px;'>Coverage: {$periodStart} to {$periodEnd}</div>
                        </td>
                        <td align='center'>{$data->billing_month}</td>
                        <td align='right'>$" . number_format($data->amount, 2) . "</td>
                    </tr>
                </tbody>
            </table>

            <div class='total-box'>
                <span style='color: #64748b; margin-right: 20px;'>Total Amount:</span>
                <span style='font-size: 24px; font-weight: bold; color: {$color};'>$" . number_format($data->amount, 2) . "</span>
            </div>

            <div style='margin-top: 40px;'>
                <div style='font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 5px;'>Status</div>
                <div style='font-weight: bold; color: ".($data->status == 'Paid' ? '#10b981' : '#f59e0b')."'>".strtoupper($data->status)."</div>
            </div>

            <div class='footer'>
                This is a computer-generated document. No signature required.<br>
                Powered by Payshia Software Solutions - Nexus Portal SaaS Engine
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
