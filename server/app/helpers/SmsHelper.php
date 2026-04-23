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

        $apiKey = $settings['sms_api_key'] ?? '';
        $baseUrl = $settings['sms_gateway_url'] ?? 'https://sms.send.lk/api/v3/sms/send';
        $senderId = $settings['sms_sender_id'] ?? 'SERVICEBAY';

        if (empty($apiKey)) {
            return ['status' => 'error', 'message' => 'SMS API Key not configured'];
        }

        // Clean recipient number (remove plus, spaces, etc.)
        $recipient = preg_replace('/[^0-9]/', '', $recipient);

        // API Request
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $baseUrl);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $apiKey,
            'Accept: application/json'
        ]);
        
        // Payload as per send.lk documentation
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
            'recipient' => $recipient,
            'sender_id' => $senderId,
            'message' => $message
        ]));

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($response === false) {
            return ['status' => 'error', 'message' => 'CURL Error: ' . curl_error($ch)];
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
