<?php
require_once 'app/core/SchemaDefinition.php';

$schema = SchemaDefinition::get();

$updates = [
    'invoices' => [
        'idx_inv_date' => ['Key_name' => 'idx_inv_date', 'Non_unique' => 1, 'Columns' => ['issue_date']],
        'idx_inv_status' => ['Key_name' => 'idx_inv_status', 'Non_unique' => 1, 'Columns' => ['status']],
        'idx_inv_created' => ['Key_name' => 'idx_inv_created', 'Non_unique' => 1, 'Columns' => ['created_at']]
    ],
    'invoice_items' => [
        'idx_ii_item' => ['Key_name' => 'idx_ii_item', 'Non_unique' => 1, 'Columns' => ['item_id']]
    ],
    'purchase_orders' => [
        'idx_po_date' => ['Key_name' => 'idx_po_date', 'Non_unique' => 1, 'Columns' => ['ordered_at']],
        'idx_po_status' => ['Key_name' => 'idx_po_status', 'Non_unique' => 1, 'Columns' => ['status']]
    ],
    'purchase_order_items' => [
        'idx_poi_item' => ['Key_name' => 'idx_poi_item', 'Non_unique' => 1, 'Columns' => ['part_id']]
    ],
    'goods_receive_notes' => [
        'idx_grn_date' => ['Key_name' => 'idx_grn_date', 'Non_unique' => 1, 'Columns' => ['received_at']]
    ],
    'grn_items' => [
        'idx_grni_item' => ['Key_name' => 'idx_grni_item', 'Non_unique' => 1, 'Columns' => ['part_id']]
    ],
    'inventory_batches' => [
        'idx_ib_grn' => ['Key_name' => 'idx_ib_grn', 'Non_unique' => 1, 'Columns' => ['grn_id']]
    ],
    'stock_movements' => [
        'idx_sm_ref' => ['Key_name' => 'idx_sm_ref', 'Non_unique' => 1, 'Columns' => ['ref_id']],
        'idx_sm_created' => ['Key_name' => 'idx_sm_created', 'Non_unique' => 1, 'Columns' => ['created_at']]
    ],
    'stock_transfer_items' => [
        'idx_sti_item' => ['Key_name' => 'idx_sti_item', 'Non_unique' => 1, 'Columns' => ['part_id']]
    ],
    'crm_inquiries' => [
        'idx_inq_created' => ['Key_name' => 'idx_inq_created', 'Non_unique' => 1, 'Columns' => ['created_at']]
    ],
    'crm_inquiry_items' => [
        'idx_inqi_item' => ['Key_name' => 'idx_inqi_item', 'Non_unique' => 1, 'Columns' => ['item_id']]
    ],
    'acc_journal_items' => [
        'idx_aji_partner' => ['Key_name' => 'idx_aji_partner', 'Non_unique' => 1, 'Columns' => ['partner_id']]
    ],
    'acc_expenses' => [
        'idx_exp_payee' => ['Key_name' => 'idx_exp_payee', 'Non_unique' => 1, 'Columns' => ['payee_id']]
    ]
];

foreach ($updates as $table => $indexes) {
    if (isset($schema[$table])) {
        foreach ($indexes as $key => $def) {
            $schema[$table]['indexes'][$key] = $def;
        }
    }
}

ksort($schema);

$code = "<?php\n\nclass SchemaDefinition {\n    public static function get() {\n        return " . var_export($schema, true) . ";\n    }\n}\n";
file_put_contents('app/core/SchemaDefinition.php', $code);
echo "SchemaDefinition.php updated successfully.\n";
