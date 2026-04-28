<?php
/**
 * SmsHelper - Handles sending SMS via configured Gateway.
 * Specifically integrated with send.lk as requested.
 */
class SmsHelper {
    
    /**
     * Send an SMS message
     * @param string $recipient The phone number (including country code, e.g. 94771234567)
     * @param string $message The text message
     * @return array Result with status and message
     */
    public static function send($recipient, $message) {
        require_once __DIR__ . '/../models/SystemSetting.php';
        $settingModel = new SystemSetting();
        $settings = $settingModel->getAll();

        // Use settings if available, fallback to provided sample token for testing
        $apiKey = $settings['sms_api_key'] ?? '29|ImkGinTXXXXXXXXXXXXXXXXXXXXXXXAJbtt4Y';
        $senderId = $settings['sms_sender_id'] ?? 'SERVICEBAY';
        $baseUrl = "https://sms.send.lk/api/v3/sms/send";

        // Clean recipient number
        $recipient = preg_replace('/[^0-9]/', '', $recipient);

        $msgdata = array(
            "recipient" => $recipient, 
            "sender_id" => $senderId, 
            "message" => $message
        );

        $curl = curl_init();
        
        // Disable SSL verification for local dev if needed
        curl_setopt($curl, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($curl, CURLOPT_SSL_VERIFYPEER, 0);
        
        curl_setopt_array($curl, array(
            CURLOPT_URL => $baseUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => "POST",
            CURLOPT_POSTFIELDS => json_encode($msgdata),
            CURLOPT_HTTPHEADER => array(
                "accept: application/json",
                "authorization: Bearer $apiKey",
                "cache-control: no-cache",
                "content-type: application/x-www-form-urlencoded",
            ),
        ));

        $response = curl_exec($curl);
        $err = curl_error($curl);
        $httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        if ($err) {
            return ['status' => 'error', 'message' => 'cURL Error #: ' . $err];
        }

        $result = json_decode($response, true);
        
        if ($httpCode >= 200 && $httpCode < 300 && isset($result['status']) && $result['status'] === 'success') {
            return ['status' => 'success', 'data' => $result];
        }

        return [
            'status' => 'error', 
            'message' => $result['message'] ?? 'Gateway returned an error (HTTP ' . $httpCode . ')',
            'raw' => $result
        ];
    }
}
