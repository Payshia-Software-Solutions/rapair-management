<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

class EmailHelper {
    
    /**
     * Send an HTML email with optional attachments
     * @param string $to Recipient email
     * @param string $subject Email subject
     * @param string $message HTML content
     * @param array $attachments Array of absolute file paths to attach
     * @return array Result with status and message
     */
    public static function send($to, $subject, $message, $attachments = []) {
        require_once __DIR__ . '/../models/SystemSetting.php';
        $settingModel = new SystemSetting();
        $settings = $settingModel->getAll();

        $fromName = $settings['mail_from_name'] ?? 'BizFlow';
        $fromEmail = $settings['mail_from_addr'] ?? 'no-reply@payshia.com';

        // Wrap message in a premium professional template
        if (strpos($message, '<html') === false) {
            $message = self::wrapTemplate($message, $subject);
        }

        $mail = new PHPMailer(true);

        try {
            // Configure SMTP if settings exist
            if (isset($settings['mail_host']) && !empty($settings['mail_host'])) {
                $mail->isSMTP();
                $mail->Host       = $settings['mail_host'];
                $mail->SMTPAuth   = !empty($settings['mail_user']);
                $mail->Username   = $settings['mail_user'] ?? '';
                $mail->Password   = $settings['mail_pass'] ?? '';
                $mail->SMTPSecure = ($settings['mail_encryption'] ?? '') === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = $settings['mail_port'] ?? 587;
                
                $mail->SMTPOptions = array(
                    'ssl' => array(
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                        'allow_self_signed' => true
                    )
                );
            } else {
                $mail->isMail();
            }

            // Recipients
            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($to);
            $mail->addReplyTo($fromEmail);

            // Attachments
            if (!empty($attachments)) {
                foreach ($attachments as $filePath) {
                    if (file_exists($filePath)) {
                        $mail->addAttachment($filePath);
                    }
                }
            }

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $message;

            $mail->send();
            return ['status' => 'success', 'message' => 'Email sent successfully.'];
        } catch (Exception $e) {
            error_log("Mailer Error: {$mail->ErrorInfo}");
            return ['status' => 'error', 'message' => "Mailer Error: {$mail->ErrorInfo}"];
        }
    }

    /**
     * Wrap content in a premium, modern responsive template
     */
    private static function wrapTemplate($content, $title) {
        $year = date('Y');
        return '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background-color: #f8fafc; }
                .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding-bottom: 40px; }
                .main { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); margin-top: 40px; }
                .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 40px 40px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase; }
                .content { padding: 40px; background-color: #ffffff; }
                .content h2 { font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 20px; }
                .footer { padding: 30px; text-align: center; font-size: 13px; color: #64748b; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; }
                .btn { display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 24px; transition: all 0.2s; }
                .info-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                .info-row:last-child { margin-bottom: 0; }
                .label { color: #64748b; font-weight: 500; }
                .value { color: #0f172a; font-weight: 700; }
                @media only screen and (max-width: 600px) {
                    .main { border-radius: 0; margin-top: 0; }
                    .content { padding: 30px 20px; }
                }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="main">
                    <div class="header">
                        <h1>BizFlow Solutions</h1>
                    </div>
                    <div class="content">
                        ' . $content . '
                    </div>
                    <div class="footer">
                        <p style="margin: 0;">&copy; ' . $year . ' Payshia Software Solutions. All rights reserved.</p>
                        <p style="margin: 8px 0 0 0; opacity: 0.7;">This is an automated message, please do not reply directly to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>';
    }
}
