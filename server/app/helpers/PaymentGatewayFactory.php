<?php
/**
 * PaymentGatewayFactory
 * Resolves the appropriate payment gateway based on settings or request.
 */
class PaymentGatewayFactory {
    public static function getGateway($identifier = 'payhere') {
        switch (strtolower($identifier)) {
            case 'payhere':
                require_once __DIR__ . '/PayHereHelper.php';
                return new PayHereHelper();
            case 'stripe':
                require_once __DIR__ . '/StripeHelper.php';
                return new StripeHelper();
            default:
                throw new Exception("Payment gateway '{$identifier}' not supported.");
        }
    }

    public static function getAllSupportedGateways() {
        return ['payhere', 'stripe'];
    }
}
