<?php
namespace App\Core;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class Mailer {
    private static function getMailer() {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = Config::SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = Config::SMTP_USER;
        $mail->Password   = Config::SMTP_PASS;
        $mail->SMTPAutoTLS = true; 
        if (Config::SMTP_PORT == 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }
        $mail->Port       = Config::SMTP_PORT;
        $mail->setFrom(Config::SMTP_FROM_EMAIL, Config::SMTP_FROM_NAME);
        return $mail;
    }

    public static function sendVerificationEmail($to, $name, $token) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $link = Config::SITE_URL . "/verify-email?token=" . $token;
            $mail->isHTML(true);
            $mail->Subject = 'Verify Your Nexus ERP Account';
            $mail->Body = "<h2>Welcome to Nexus ERP, $name!</h2><p>Please verify your email: <a href='$link'>$link</a></p>";
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendInvoiceEmail($to, $name, $invoiceNumber, $pdfContent, $period) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = "New Invoice #$invoiceNumber for $period from Nebulink";
            
            $mail->Body = "
                <div style=\"font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">
                    <div style=\"background: #6366f1; padding: 40px; text-align: center;\">
                        <h1 style=\"color: white; margin: 0; font-size: 24px;\">Invoice Generated</h1>
                        <p style=\"color: #e0e7ff; margin-top: 10px;\">Period: $period</p>
                    </div>
                    <div style=\"padding: 40px;\">
                        <h3 style=\"margin-top: 0;\">Hello $name,</h3>
                        <p style=\"line-height: 1.6;\">Your enterprise subscription invoice for <strong>$period</strong> has been generated successfully.</p>
                        <div style=\"background: #f8fafc; padding: 20px; border-radius: 12px; margin: 30px 0;\">
                            <table width=\"100%\">
                                <tr>
                                    <td style=\"color: #64748b; font-size: 12px; text-transform: uppercase;\">Invoice Number</td>
                                    <td align=\"right\" style=\"font-weight: bold;\">#$invoiceNumber</td>
                                </tr>
                                <tr>
                                    <td style=\"color: #64748b; font-size: 12px; text-transform: uppercase; padding-top: 10px;\">Billing Cycle</td>
                                    <td align=\"right\" style=\"font-weight: bold; padding-top: 10px;\">$period</td>
                                </tr>
                            </table>
                        </div>
                        <p style=\"line-height: 1.6;\">We have attached the detailed invoice PDF to this email for your records. Please ensure payment is processed by the due date mentioned in the document.</p>
                        <p style=\"margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;\">
                            Best regards,<br>
                            <strong>The Nebulink Billing Team</strong>
                        </p>
                    </div>
                    <div style=\"background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;\">
                        &copy; ".date('Y')." Nebulink Systems (Pvt) Ltd. All rights reserved.
                    </div>
                </div>
            ";
            
            $mail->addStringAttachment($pdfContent, "Invoice_$invoiceNumber.pdf");
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendPaymentReceipt($to, $name, $invoiceNumber, $pdfContent) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = "Payment Receipt for Invoice #$invoiceNumber";
            $mail->Body = "<h3>Thank you for your payment, $name!</h3><p>We have successfully processed your payment for invoice #$invoiceNumber. Your receipt is attached to this email.</p>";
            $mail->addStringAttachment($pdfContent, "Receipt_$invoiceNumber.pdf");
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendPaymentReceiptEmail($to, $tenantName, $receiptNumber, $pdfContent, $amount, $currency) {
        $subject = "Payment Receipt #{$receiptNumber} for Nexus Portal";
        
        $body = "
        <div style='font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;'>
            <div style='background: #10b981; padding: 40px; text-align: center; color: white;'>
                <h1 style='margin: 0; font-size: 24px;'>Payment Received!</h1>
                <p style='margin-top: 10px; opacity: 0.9;'>Thank you for your business.</p>
            </div>
            <div style='padding: 40px;'>
                <p>Hi <strong>{$tenantName}</strong>,</p>
                <p>We have successfully received your payment of <strong>{$currency} " . number_format($amount, 2) . "</strong>. Your receipt <strong>#{$receiptNumber}</strong> is attached to this email for your records.</p>
                
                <div style='background: #f8fafc; padding: 25px; border-radius: 12px; margin: 30px 0;'>
                    <table width='100%'>
                        <tr>
                            <td style='color: #64748b; font-size: 12px; text-transform: uppercase;'>Receipt Number</td>
                            <td align='right' style='font-weight: bold;'>#{$receiptNumber}</td>
                        </tr>
                        <tr>
                            <td style='color: #64748b; font-size: 12px; text-transform: uppercase; padding-top: 10px;'>Amount Paid</td>
                            <td align='right' style='font-weight: bold; padding-top: 10px; color: #10b981;'>{$currency} " . number_format($amount, 2) . "</td>
                        </tr>
                    </table>
                </div>
                
                <p>If you have any questions, feel free to reply to this email.</p>
                <p style='margin-top: 40px;'>Best regards,<br><strong>Nebulink Billing Team</strong></p>
            </div>
            <div style='background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;'>
                &copy; " . date('Y') . " Nebulink. All rights reserved.
            </div>
        </div>
        ";
        
        return self::send($to, $subject, $body, [
            ['content' => $pdfContent, 'filename' => "Receipt_{$receiptNumber}.pdf"]
        ]);
    }
}
