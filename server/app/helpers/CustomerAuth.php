<?php
/**
 * Storefront customer sign-in tokens (signed JWT, HS256, same secret as the staff login).
 * The token only says which customer it belongs to; every request still checks that the customer is an active storefront account.
 */
require_once __DIR__ . '/JwtHelper.php';

class CustomerAuth {
    /** How long a storefront login lasts before the shopper must sign in again: 30 days. */
    const TTL_SECONDS = 2592000;

    public static function issue($customerId) {
        $now = time();
        return JwtHelper::encode([
            'sub' => (int)$customerId,
            'typ' => 'customer',
            'iat' => $now,
            'exp' => $now + self::TTL_SECONDS,
        ], JWT_SECRET);
    }

    /** The customer ID from a valid "Authorization: Bearer <token>" header, or null when there is none or it is not valid. */
    public static function customerIdFromRequest() {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if ($auth === '' && function_exists('apache_request_headers')) {
            $headers = apache_request_headers();
            $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if (stripos($auth, 'Bearer ') !== 0) return null;

        $payload = JwtHelper::decode(trim(substr($auth, 7)), JWT_SECRET);
        if (!is_array($payload) || ($payload['typ'] ?? '') !== 'customer' || empty($payload['sub'])) return null;
        return (int)$payload['sub'];
    }
}
