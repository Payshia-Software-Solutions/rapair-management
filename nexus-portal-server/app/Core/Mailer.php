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

    public static function sendInvoiceEmail($to, $name, $invoiceNumber, $pdfContent) {
        try {
            $mail = self::getMailer();
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = "New Invoice #$invoiceNumber from Nexus Portal";
            $mail->Body = "<h3>Hello $name,</h3><p>Your new invoice for the current billing period has been generated. Please find the attached PDF for details.</p><p>Thank you for choosing Nexus Portal.</p>";
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
}
