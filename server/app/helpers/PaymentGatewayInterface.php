<?php
/**
 * PaymentGatewayInterface
 * Standard interface for all IPG providers.
 */
interface PaymentGatewayInterface {
    /**
     * Prepare parameters for checkout (redirect/form submission)
     */
    public function prepareCheckout($order, $items, $customer, $settings);

    /**
     * Validate incoming notification (webhook)
     */
    public function validateNotification($data, $settings);

    /**
     * Get the provider's identifier (e.g. 'payhere', 'stripe')
     */
    public function getIdentifier();
}
