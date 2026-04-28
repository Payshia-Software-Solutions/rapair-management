<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\SMTP;

class EmailHelper {
    
    /**
     * Send an HTML email
     * @param string $to Recipient email
     * @param string $subject Email subject
     * @param string $message HTML content
     * @return array Result with status and message
     */
    public static function send($to, $subject, $message) {
        require_once __DIR__ . '/../models/SystemSetting.php';
        $settingModel = new SystemSetting();
        $settings = $settingModel->getAll();

        $fromName = $settings['mail_from_name'] ?? 'BizFlow';
        $fromEmail = $settings['mail_from_addr'] ?? 'no-reply@payshia.com';

        // Wrap message in a basic professional template if not already
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
                $mail->SMTPSecure = $settings['mail_encryption'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = $settings['mail_port'] ?? 587;
                
                // Allow self-signed certs for local testing if needed
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

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $message;

            $mail->send();
            return ['status' => 'success', 'message' => 'Email sent.'];
        } catch (Exception $e) {
            return ['status' => 'error', 'message' => "Mailer Error: {$mail->ErrorInfo}"];
        }
    }

    /**
     * Wrap content in a clean, professional newsletter template
     */
    private static function wrapTemplate($content, $title) {
        return '
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .content { padding: 40px; }
                .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; }
                .btn { display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content">
                    ' . $content . '
                </div>
                <div class="footer">
                    &copy; ' . date('Y') . ' Payshia Software Solutions. All rights reserved.
                </div>
            </div>
        </body>
        </html>';
    }
}
