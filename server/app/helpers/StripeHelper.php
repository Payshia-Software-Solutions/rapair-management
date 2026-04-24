<?php
/**
 * StripeHelper
 * Minimal implementation for demonstration.
 */
require_once __DIR__ . '/PaymentGatewayInterface.php';

class StripeHelper implements PaymentGatewayInterface {
    
    public function getIdentifier() {
        return 'stripe';
    }

    public function prepareCheckout($order, $items, $customer, $settings) {
        $isSandbox = (int)($settings['stripe_is_sandbox'] ?? 1) === 1;
        
        if ($isSandbox) {
            $publishableKey = $settings['stripe_publishable_key_sandbox'] ?? '';
            $secretKey = $settings['stripe_secret_key_sandbox'] ?? '';
        } else {
            $publishableKey = $settings['stripe_publishable_key_live'] ?? '';
            $secretKey = $settings['stripe_secret_key_live'] ?? '';
        }

        // Stripe usually happens client-side or via a session.
        // For now, we return params needed by the frontend Stripe.js
        return [
            'publishable_key' => $publishableKey,
            'client_reference_id' => $order->order_no,
            'customer_email' => $customer['email'] ?? '',
            'mode' => 'payment',
            'gateway_type' => 'stripe',
            'is_sandbox' => $isSandbox
        ];
    }

    public function validateNotification($data, $settings) {
        // Stripe uses webhooks with signature verification
        // This would require stripe-php library usually.
        // For demonstration, we'll assume validation logic exists.
        return true; 
    }
}
