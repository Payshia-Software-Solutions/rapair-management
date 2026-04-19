<?php
require_once __DIR__ . '/../server/app/config.php';
require_once __DIR__ . '/../server/app/core/Database.php';
require_once __DIR__ . '/../server/app/core/Model.php';
require_once __DIR__ . '/../server/app/core/Controller.php';

// Mock everything needed for InvoiceController
class Setup {
    public static function run() {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        
        // Setup dummy JWT decode
        require_once __DIR__ . '/../server/app/controllers/InvoiceController.php';
        
        $payload = '{
            "held_order_id": null,
            "location_id": 1,
            "customer_id": 2,
            "billing_address": "Galpadithenna Tea Factory",
            "shipping_address": "Galpadithenna Tea Factory",
            "issue_date": "2026-04-19",
            "due_date": "2026-04-19",
            "subtotal": 450,
            "tax_total": 92.25,
            "discount_total": 0,
            "grand_total": 542.25,
            "order_type": "retail",
            "table_id": null,
            "steward_id": null,
            "applied_taxes": [],
            "notes": "POS Retail Sale",
            "applied_promotion_id": 8,
            "applied_promotion_name": "Brak pad 5 1",
            "bank_id": null,
            "card_category": "Credit",
            "items": [
                {
                    "description": "Brake Pads",
                    "item_type": "Part",
                    "item_id": 2,
                    "quantity": 10,
                    "unit_price": "45.00",
                    "discount": 0,
                    "tax_amount": 0,
                    "line_total": 450
                }
            ],
            "payments": []
        }';
        
        // Fake input stream
        file_put_contents('php://memory', $payload);
        
        $controller = new InvoiceController();
        // Override requirePermission
        // Can't easily override if it's not a mock, but let's check InvoiceController::requirePermission
    }
}
$db = new Database();
// We can't really call the controller easily if requirePermission does JWT checks.
