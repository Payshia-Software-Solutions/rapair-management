<?php
namespace App\Core;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class Mailer {
    public static $lastBody = null;

    private static function addCCAddresses($mail, $ccEmail) {
        if (!$ccEmail) return;
        $ccs = [];
        $decoded = json_decode($ccEmail, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $ccs = $decoded;
        } else {
            $ccs = explode(',', $ccEmail);
        }
        foreach ($ccs as $cc) {
            $addr = trim($cc);
            if (!empty($addr) && filter_var($addr, FILTER_VALIDATE_EMAIL)) {
                $mail->addCC($addr);
            }
        }
    }

    /**
     * $globalCopies = false leaves out the global CC/BCC (Admin -> Settings -> Mail). Use it for mail
     * meant only for its recipient: activation links, confirmation codes, passwords.
     */
    private static function getMailer($globalCopies = true) {
        // Fetch Mail Settings from DB
        $db = new Database();
        $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'smtp_%'");
        $results = $db->resultSet();
        $dbSettings = [];
        foreach ($results as $row) {
            $dbSettings[$row->setting_key] = $row->setting_value;
        }

        // Local development: Config::MAIL_DISABLED() = true never connects to a mail server (the DB holds
        // the real SMTP settings, which would email real clients). Emails are saved as files instead.
        $mail = Config::MAIL_DISABLED() ? new OutboxMailer(true) : new PHPMailer(true);
        $mail->isSMTP();
        
        $host = $dbSettings['smtp_host'] ?? Config::SMTP_HOST();
        $port = $dbSettings['smtp_port'] ?? Config::SMTP_PORT();
        $user = $dbSettings['smtp_user'] ?? Config::SMTP_USER();
        $pass = $dbSettings['smtp_pass'] ?? Config::SMTP_PASS();
        $enc  = $dbSettings['smtp_encryption'] ?? ($port == 465 ? 'ssl' : 'tls');
        $fromName = $dbSettings['smtp_from_name'] ?? Config::SMTP_FROM_NAME();
        $fromEmail = $dbSettings['smtp_from_email'] ?? Config::SMTP_FROM_EMAIL();

        $mail->Host       = $host;
        $mail->SMTPAuth   = true;
        $mail->Username   = $user;
        $mail->Password   = $pass;
        $mail->SMTPAutoTLS = true; 
        
        if ($enc == 'ssl' || $port == 465) {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
        } else {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        }
        
        $mail->Port       = $port;
        $mail->setFrom($fromEmail, $fromName);

        // Bypass SSL verification for local/XAMPP compatibility
        $mail->SMTPOptions = [
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false,
                'allow_self_signed' => true
            ]
        ];

        // Fetch Global CC/BCC from settings or fallback to defaults
        $globalCC = $dbSettings['smtp_global_cc'] ?? 'accounts@nebulync.com';
        $globalBCC = $dbSettings['smtp_global_bcc'] ?? 'thilinaruwan112@gmail.com';

        // Global CC and BCC as requested (wrapped in try-catch to prevent blocking)
        try {
            if ($globalCopies && !empty($globalCC)) $mail->addCC($globalCC);
            if ($globalCopies && !empty($globalBCC)) $mail->addBCC($globalBCC);
        } catch (\Exception $e) {
            error_log("Global Mailer CC/BCC Error: " . $e->getMessage());
        }

        return $mail;
    }

    /** Company details from Admin -> Settings -> Company, for email footers. */
    private static function company() {
        static $c = null;
        if ($c !== null) return $c;
        $c = ['company_name' => 'Nebulync Software Pvt Ltd', 'company_address' => '', 'company_email' => '', 'company_phone' => '', 'company_website' => ''];
        try {
            $db = new Database();
            $db->query("SELECT setting_key, setting_value FROM saas_settings WHERE setting_key LIKE 'company_%'");
            foreach ($db->resultSet() as $r) if ($r->setting_value !== '') $c[$r->setting_key] = $r->setting_value;
        } catch (\Throwable $e) {
            error_log('Mailer company settings: ' . $e->getMessage());
        }
        return $c;
    }

    /**
     * Branded email layout: table-based with inline styles so it renders the same in Gmail, Outlook and
     * phone mail apps. $o: preheader, heading, body (HTML, already escaped), button => [label, url], note.
     */
    public static function layout(array $o) {
        $e = function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); };
        $c = self::company();
        $logo = rtrim(Config::SITE_URL(), '/') . '/bizzflow-logo.png';
        $font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
        $heading = isset($o['heading'])
            ? '<h1 style="margin:0 0 16px;font-size:22px;line-height:30px;font-weight:700;color:#0f172a;">' . $e($o['heading']) . '</h1>'
            : '';

        $button = '';
        if (!empty($o['button'])) {
            [$label, $url] = $o['button'];
            $button = '
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                <tr><td align="center" bgcolor="#4f46e5" style="border-radius:8px;">
                  <a href="' . $e($url) . '" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">' . $e($label) . '</a>
                </td></tr>
              </table>
              <p style="margin:0 0 6px;font-size:13px;line-height:20px;color:#64748b;">If the button does not work, copy this link into your browser:</p>
              <p style="margin:0 0 8px;font-size:13px;line-height:20px;word-break:break-all;"><a href="' . $e($url) . '" style="color:#4f46e5;text-decoration:underline;">' . $e($url) . '</a></p>';
        }

        $note = !empty($o['note'])
            ? '<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;">' . $e($o['note']) . '</p>'
            : '';

        $contact = array_filter([$c['company_email'], $c['company_phone'], $c['company_website']]);
        $footer = '<strong style="color:#475569;">' . $e($c['company_name']) . '</strong>'
            . ($c['company_address'] ? '<br>' . $e($c['company_address']) : '')
            . ($contact ? '<br>' . implode(' &middot; ', array_map($e, $contact)) : '');

        return '<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>' . $e($o['heading'] ?? 'BizzFlow') . '</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">' . $e($o['preheader'] ?? '') . '</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1f5f9;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;font-family:' . $font . ';">
        <tr><td align="left" style="padding:0 4px 20px;">
          <img src="' . $e($logo) . '" alt="BizzFlow" height="32" style="display:block;height:32px;width:auto;border:0;">
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:36px 36px 32px;font-size:15px;line-height:24px;color:#334155;">
          ' . $heading . '
          ' . ($o['body'] ?? '') . '
          ' . $button . '
          ' . $note . '
        </td></tr>
        <tr><td align="center" style="padding:24px 16px 0;font-size:12px;line-height:18px;color:#94a3b8;">
          ' . $footer . '<br>&copy; ' . date('Y') . ' ' . $e($c['company_name']) . '. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>';
    }

    /** Plain-text version for mail apps that do not show HTML (also helps spam scores). */
    private static function plainText($html) {
        $t = preg_replace('/<(style|title)\b.*?<\/\1>/is', '', $html);
        $t = preg_replace('/<div style="display:none.*?<\/div>/is', '', $t);
        $t = preg_replace('/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/is', '$2 ($1)', $t);
        $t = preg_replace('/<(br|\/p|\/h1|\/h2|\/tr|\/div)[^>]*>/i', "\n", $t);
        $t = html_entity_decode(strip_tags($t), ENT_QUOTES, 'UTF-8');
        $t = preg_replace('/[ \t]+/', ' ', $t);
        $t = preg_replace("/ *\n */", "\n", $t);
        return trim(preg_replace("/\n{3,}/", "\n\n", $t));
    }

    /** Account activation link. Sent to the new user only (no global CC/BCC). */
    public static function sendVerificationEmail($to, $name, $token) {
        try {
            $mail = self::getMailer(false);
            $mail->addAddress($to, $name);
            $link = rtrim(Config::SITE_URL(), '/') . '/verify-email?token=' . urlencode($token);
            $first = trim(explode(' ', trim((string)$name))[0] ?? '') ?: 'there';
            $h = function ($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); };
            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = 'Activate your BizzFlow account';
            $mail->Body = self::layout([
                'preheader' => 'Confirm your email address to finish setting up your BizzFlow account.',
                'heading' => 'Confirm your email address',
                'body' => '<p style="margin:0 0 16px;">Hi ' . $h($first) . ',</p>'
                    . '<p style="margin:0 0 16px;">Thank you for signing up for BizzFlow. Please confirm that <strong>'
                    . $h($to) . '</strong> is your email address to activate your account.</p>'
                    . '<p style="margin:0;">Once it is confirmed, you can sign in and we will set up your workspace.</p>',
                'button' => ['Activate my account', $link],
                'note' => 'If you did not create a BizzFlow account, you can ignore this email. No account will be activated.',
            ]);
            $mail->AltBody = self::plainText($mail->Body);
            self::$lastBody = $mail->Body;
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendInvoiceEmail($to, $name, $invoiceNumber, $pdfContent, $period, $amount, $currency, $ccEmail = null, $customDescription = null) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            self::addCCAddresses($mail, $ccEmail);
            $mail->isHTML(true);

            $isReminder = $customDescription && (strpos($customDescription, 'Reminder') !== false || strpos($customDescription, 'NOTICE') !== false);
            
            if ($customDescription) {
                if (strpos($customDescription, '[') === 0 || $isReminder) {
                    $mail->Subject = $customDescription;
                } else {
                    $mail->Subject = "New Invoice #$invoiceNumber - $customDescription";
                }
            } else {
                $mail->Subject = "New Invoice #$invoiceNumber for $period from Nebulink - $name";
            }
            
            $heading = $isReminder ? "Payment Reminder" : "Invoice Generated";
            $subheading = $isReminder ? "Urgent Action Required" : "Period: $period";
            $introText = $isReminder 
                ? "This is a payment reminder for invoice <strong>#$invoiceNumber</strong> for the billing period of <strong>$period</strong>. Our records show that this balance remains unpaid."
                : "Your enterprise subscription invoice for <strong>$period</strong> has been generated successfully.";
            
            $mail->Body = "
                <div style=\"font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">
                    <div style=\"background: " . ($isReminder ? '#ef4444' : '#6366f1') . "; padding: 40px; text-align: center;\">
                        <h1 style=\"color: white; margin: 0; font-size: 24px;\">$heading</h1>
                        <p style=\"color: #e0e7ff; margin-top: 10px;\">$subheading</p>
                    </div>
                    <div style=\"padding: 40px;\">
                        <h3 style=\"margin-top: 0;\">Hello $name,</h3>
                        <p style=\"line-height: 1.6;\">$introText</p>
                        
                        <div style=\"background: #f8fafc; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #e2e8f0;\">
                            <table width=\"100%\" style=\"font-size: 14px;\">
                                <tr>
                                    <td style=\"color: #64748b; padding: 5px 0;\">Invoice Number</td>
                                    <td align=\"right\" style=\"font-weight: bold; color: #1e293b;\">#$invoiceNumber</td>
                                </tr>
                                <tr>
                                    <td style=\"color: #64748b; padding: 5px 0;\">Billing Month</td>
                                    <td align=\"right\" style=\"font-weight: bold; color: #1e293b;\">$period</td>
                                </tr>
                                <tr>
                                    <td colspan=\"2\" style=\"border-top: 1px solid #e2e8f0; margin: 10px 0; padding-top: 10px;\"></td>
                                </tr>
                                <tr>
                                    <td style=\"color: #64748b; font-weight: bold;\">Total Amount</td>
                                    <td align=\"right\" style=\"font-size: 18px; font-weight: 900; color: #6366f1;\">$currency " . number_format($amount, 2) . "</td>
                                </tr>
                            </table>
                        </div>

                        <p style=\"line-height: 1.6;\">We have attached the detailed invoice PDF to this email for your records. Please ensure payment is processed by the due date mentioned in the document.</p>
                        <p style=\"margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;\">
                            Best regards,<br>
                            <strong>The Nebulync Billing Team</strong>
                        </p>
                    </div>
                    <div style=\"background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;\">
                        &copy; ".date('Y')." Nebulync Systems (Pvt) Ltd. All rights reserved.
                    </div>
                </div>
            ";
            
            $mail->addStringAttachment($pdfContent, "Invoice_$invoiceNumber.pdf");
            self::$lastBody = $mail->Body;
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendPaymentReceipt($to, $name, $invoiceNumber, $receiptPdf, $invoicePdf, $amount, $currency, $receiptNumber, $ccEmail = null) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            self::addCCAddresses($mail, $ccEmail);
            $mail->isHTML(true);
            $mail->Subject = "Payment Receipt for Invoice #$invoiceNumber - $name | Nebulync";
            
            $mail->Body = "
                <div style=\"font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">
                    <div style=\"background: #10b981; padding: 40px; text-align: center;\">
                        <h1 style=\"color: white; margin: 0; font-size: 24px;\">Payment Received</h1>
                        <p style=\"color: #d1fae5; margin-top: 10px;\">Thank you for your business.</p>
                    </div>
                    <div style=\"padding: 40px;\">
                        <h3 style=\"margin-top: 0;\">Hello $name,</h3>
                        <p style=\"line-height: 1.6;\">We have successfully received and processed your payment for invoice <strong>#$invoiceNumber</strong>.</p>
                        
                        <div style=\"background: #f0fdf4; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #dcfce7;\">
                            <table width=\"100%\" style=\"font-size: 14px;\">
                                <tr>
                                    <td style=\"color: #166534; padding: 5px 0;\">Receipt Number</td>
                                    <td align=\"right\" style=\"font-weight: bold; color: #166534;\">#$receiptNumber</td>
                                </tr>
                                <tr>
                                    <td style=\"color: #166534; padding: 5px 0;\">Invoice Reference</td>
                                    <td align=\"right\" style=\"font-weight: bold; color: #166534;\">#$invoiceNumber</td>
                                </tr>
                                <tr>
                                    <td colspan=\"2\" style=\"border-top: 1px solid #dcfce7; margin: 10px 0; padding-top: 10px;\"></td>
                                </tr>
                                <tr>
                                    <td style=\"color: #166534; font-weight: bold;\">Amount Paid</td>
                                    <td align=\"right\" style=\"font-size: 20px; font-weight: 900; color: #10b981;\">$currency " . number_format($amount, 2) . "</td>
                                </tr>
                            </table>
                        </div>

                        <p style=\"line-height: 1.6;\">For your records, we have attached both the <strong>Official Receipt</strong> and the <strong>Paid Invoice</strong> to this email.</p>
                        
                        <p style=\"margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;\">
                            If you have any questions regarding this transaction, please contact our billing department.<br><br>
                            Best regards,<br>
                            <strong>The Nebulync Billing Team</strong>
                        </p>
                    </div>
                    <div style=\"background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;\">
                        &copy; ".date('Y')." Nebulync Systems (Pvt) Ltd. All rights reserved.
                    </div>
                </div>
            ";
            
            $mail->addStringAttachment($receiptPdf, "Receipt_$invoiceNumber.pdf");
            $mail->addStringAttachment($invoicePdf, "Paid_Invoice_$invoiceNumber.pdf");
            self::$lastBody = $mail->Body;
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
                <p style='margin-top: 40px;'>Best regards,<br><strong>Nebulync Billing Team</strong></p>
            </div>
            <div style='background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;'>
                &copy; " . date('Y') . " Nebulync. All rights reserved.
            </div>
        </div>
        ";
        
        return self::send($to, $subject, $body, [
            ['content' => $pdfContent, 'filename' => "Receipt_{$receiptNumber}.pdf"]
        ]);
    }

    private static function send($to, $subject, $body, $attachments = [], $cc = null) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to);
            if ($cc) self::addCCAddresses($mail, $cc);
            
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $body;
            
            foreach ($attachments as $att) {
                if (isset($att['content'])) {
                    $mail->addStringAttachment($att['content'], $att['filename']);
                }
            }
            
            self::$lastBody = $body;
            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Send Error: {$e->getMessage()}");
            return false;
        }
    }

    public static function sendTenantUpdateEmail($to, $name, $changes) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = "Account Update: Your Nexus Portal Configuration has been updated";
            
            $changeRows = "";
            foreach ($changes as $field => $data) {
                $changeRows .= "
                    <tr>
                        <td style='padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase;'>$field</td>
                        <td style='padding: 10px; border-bottom: 1px solid #f1f5f9; font-weight: bold; color: #1e293b;'>{$data['old']} &rarr; {$data['new']}</td>
                    </tr>
                ";
            }

            $mail->Body = "
                <div style=\"font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">
                    <div style=\"background: #6366f1; padding: 40px; text-align: center;\">
                        <h1 style=\"color: white; margin: 0; font-size: 24px;\">Account Updated</h1>
                        <p style=\"color: #e0e7ff; margin-top: 10px;\">Configuration changes detected</p>
                    </div>
                    <div style=\"padding: 40px;\">
                        <h3 style=\"margin-top: 0;\">Hello $name,</h3>
                        <p style=\"line-height: 1.6;\">This is an automated notification to inform you that your <strong>Nexus Portal</strong> account configuration has been updated by an administrator.</p>
                        
                        <div style=\"background: #f8fafc; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #e2e8f0;\">
                            <h4 style='margin-top: 0; margin-bottom: 15px; font-size: 14px; color: #475569;'>Summary of Changes:</h4>
                            <table width=\"100%\" style=\"font-size: 14px; border-collapse: collapse;\">
                                $changeRows
                            </table>
                        </div>

                        <p style=\"line-height: 1.6;\">If you did not request these changes or have any questions regarding your subscription status, please contact our support team immediately.</p>
                        
                        <p style=\"margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;\">
                            Best regards,<br>
                            <strong>The Nexus Systems Team</strong>
                        </p>
                    </div>
                    <div style=\"background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;\">
                        &copy; ".date('Y')." Nebulync Systems (Pvt) Ltd. All rights reserved.
                    </div>
                </div>
            ";
            
            return $mail->send();
        } catch (\Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * $private = true: for mail with codes, passwords or anything only the recipient should see.
     * Leaves out the global CC/BCC (and ignores $cc).
     */
    public static function sendCustomEmail($to, $name, $subject, $body, $cc = null, $private = false) {
        try {
            $mail = self::getMailer(!$private);
            $mail->addAddress($to, $name);
            if (!$private) self::addCCAddresses($mail, $cc);

            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body = self::layout(['preheader' => $subject, 'body' => $body]);
            $mail->AltBody = self::plainText($mail->Body);
            self::$lastBody = $mail->Body;
            return $mail->send();
        } catch (Exception $e) {
            error_log("Custom Mailer Error: " . $e->getMessage());
            return false;
        }
    }

    public static function sendSuspensionEmail($to, $name, $reason) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = "Your BizzFlow workspace has been suspended";

            $safeName = htmlspecialchars($name, ENT_QUOTES);
            $safeReason = htmlspecialchars($reason, ENT_QUOTES);
            $mail->Body = "
                <div style=\"font-family: sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;\">
                    <div style=\"background: #ef4444; padding: 40px; text-align: center;\">
                        <h1 style=\"color: white; margin: 0; font-size: 24px;\">Workspace suspended</h1>
                    </div>
                    <div style=\"padding: 40px;\">
                        <h3 style=\"margin-top: 0;\">Hello $safeName,</h3>
                        <p style=\"line-height: 1.6;\">Access to your <strong>$safeName</strong> workspace has been suspended.</p>
                        <div style=\"background: #fef2f2; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #fee2e2;\">
                            <p style=\"margin: 0; color: #991b1b;\"><strong>Reason:</strong></p>
                            <p style=\"margin: 10px 0 0 0; color: #7f1d1d;\">$safeReason</p>
                        </div>
                        <p style=\"line-height: 1.6;\">If you think this is a mistake, reply to this email and our team will help you restore access.</p>
                        <p style=\"margin-top: 40px; border-top: 1px solid #f1f5f9; padding-top: 20px; font-size: 13px; color: #64748b;\">
                            Best regards,<br>
                            <strong>The Nexus Systems Team</strong>
                        </p>
                    </div>
                    <div style=\"background: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8;\">
                        &copy; ".date('Y')." Nebulync Systems (Pvt) Ltd. All rights reserved.
                    </div>
                </div>
            ";

            return $mail->send();
        } catch (Exception $e) {
            error_log("Mailer Error: {$e->getMessage()}");
            return false;
        }
    }
}

/**
 * Local development stand-in for PHPMailer (Config::MAIL_DISABLED()): send() writes the email to
 * scratch/mail_outbox/<time>_<subject>.html and never contacts a mail server.
 */
class OutboxMailer extends PHPMailer {
    public function send() {
        $dir = __DIR__ . '/../../scratch/mail_outbox';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $to = implode(', ', array_map(function ($a) { return $a[0]; }, $this->getToAddresses()));
        $name = date('Ymd_His') . '_' . preg_replace('/[^A-Za-z0-9]+/', '-', substr((string)$this->Subject, 0, 60)) . '.html';
        $html = "<!-- To: " . htmlspecialchars($to) . " | Subject: " . htmlspecialchars((string)$this->Subject) . " -->\n"
              . "<p style='font:13px sans-serif;color:#666'>LOCAL OUTBOX (not sent) &middot; To: " . htmlspecialchars($to) . "</p>\n" . $this->Body;
        file_put_contents($dir . '/' . $name, $html);
        error_log("Mailer (local): saved to scratch/mail_outbox/$name instead of sending");
        return true;
    }
}
