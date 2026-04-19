<?php
$url = 'http://localhost/rapair-management/server/api/invoice/create';
$data = [
    "held_order_id" => null,
    "location_id" => 1,
    "customer_id" => 2,
    "billing_address" => "Galpadithenna Tea Factory, Lellopitiya",
    "shipping_address" => "Galpadithenna Tea Factory, Lellopitiya",
    "issue_date" => "2026-04-19",
    "due_date" => "2026-04-19",
    "subtotal" => 450,
    "tax_total" => 92.25,
    "discount_total" => 0,
    "grand_total" => 542.25,
    "order_type" => "retail",
    "table_id" => null,
    "steward_id" => null,
    "applied_taxes" => [
        [
            "name" => "Social Security Contribution Levy",
            "code" => "SSCL",
            "rate_percent" => "2.5000",
            "amount" => 11.25
        ],
        [
            "name" => "Value Added Tax",
            "code" => "VAT",
            "rate_percent" => "18.0000",
            "amount" => 81
        ]
    ],
    "notes" => "POS Retail Sale",
    "applied_promotion_id" => 8,
    "applied_promotion_name" => "Brak pad 5 1",
    "bank_id" => null,
    "card_category" => "Credit",
    "items" => [
        [
            "description" => "Brake Pads",
            "item_type" => "Part",
            "item_id" => 2,
            "quantity" => 10,
            "unit_price" => "45.00",
            "discount" => 0,
            "tax_amount" => 0,
            "line_total" => 450
        ]
    ],
    "payments" => [
        [
            "method" => "Cash",
            "amount" => 542.25,
            "cardLast4" => "",
            "cardType" => "Visa",
            "cardAuthCode" => "",
            "chequeNo" => "",
            "chequeBankName" => "",
            "chequeBranchName" => "",
            "chequeDate" => "2026-04-19",
            "chequePayee" => ""
        ]
    ]
];

$loginData = json_encode(['email' => 'admin@winpharma.com', 'password' => 'password']);
$chLogin = curl_init('http://localhost/rapair-management/server/api/auth/login');
curl_setopt($chLogin, CURLOPT_RETURNTRANSFER, true);
curl_setopt($chLogin, CURLOPT_POST, true);
curl_setopt($chLogin, CURLOPT_POSTFIELDS, $loginData);
$loginResp = curl_exec($chLogin);
curl_close($chLogin);
$loginJson = json_decode($loginResp, true);
$token = $loginJson['token'] ?? '';

echo "Token: " . substr($token, 0, 10) . "...\n";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Authorization: Bearer ' . $token]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$result = curl_exec($ch);
curl_close($ch);
echo "Result:\n$result\n";
