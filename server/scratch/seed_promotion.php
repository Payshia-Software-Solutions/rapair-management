<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/helpers/PromotionSchema.php';
require_once __DIR__ . '/../app/core/Database.php';

// Sync schema
PromotionSchema::ensure();

$db = new Database();

// Clear existing to avoid duplicates
$db->query("DELETE FROM promotions WHERE name = 'Super Saver Bundle'");
$db->execute();

// 1. Create Promotion
$db->query("
    INSERT INTO promotions (name, description, type, start_date, is_active, priority)
    VALUES ('Super Saver Bundle', 'Auto-detected discount for high-value carts!', 'Bundle', CURDATE(), 1, 10)
");
$db->execute();
$promoId = $db->lastInsertId();

// 2. Add Condition (Min Bill Amount > 100)
$db->query("
    INSERT INTO promotion_conditions (promotion_id, condition_type, requirement_value, operator)
    VALUES (:pid, 'MinAmount', '100', '>=')
");
$db->bind(':pid', $promoId);
$db->execute();

// 3. Add Benefit (Flat 150.00 discount)
$db->query("
    INSERT INTO promotion_benefits (promotion_id, benefit_type, benefit_value)
    VALUES (:pid, 'FixedAmount', 150.00)
");
$db->bind(':pid', $promoId);
$db->execute();

echo "Succesfully seeded 'Super Saver Bundle' (ID: $promoId)\n";
echo "Conditions: Min Amount >= 100\n";
echo "Benefit: Fixed LKR 150.00 Discount\n";
