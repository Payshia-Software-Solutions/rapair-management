<?php
require_once 'c:\xampp\htdocs\rapair-management\server\config\config.php';

try {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME;
    $pdo = new PDO($dsn, DB_USER, DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    function hasColumn($pdo, $table, $col) {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM {$table} LIKE ?");
        $stmt->execute([$col]);
        return (bool)$stmt->fetch(PDO::FETCH_ASSOC);
    }

    echo "Checking grn_items columns...\n";
    $cols = [
        'batch_number' => "VARCHAR(100) NULL",
        'mfg_date' => "DATE NULL",
        'expiry_date' => "DATE NULL",
    ];
    foreach ($cols as $col => $def) {
        if (!hasColumn($pdo, 'grn_items', $col)) {
            $pdo->exec("ALTER TABLE grn_items ADD COLUMN {$col} {$def}");
            echo "Added $col to grn_items.\n";
        }
    }

    echo "Checking stock_movements columns...\n";
    if (!hasColumn($pdo, 'stock_movements', 'batch_id')) {
        $pdo->exec("ALTER TABLE stock_movements ADD COLUMN batch_id INT NULL AFTER part_id");
        $pdo->exec("ALTER TABLE stock_movements ADD INDEX idx_sm_batch (batch_id)");
        echo "Added batch_id to stock_movements.\n";
    }

    echo "Checking order_parts columns...\n";
    if (!hasColumn($pdo, 'order_parts', 'batch_id')) {
        $pdo->exec("ALTER TABLE order_parts ADD COLUMN batch_id INT NULL AFTER part_id");
        echo "Added batch_id to order_parts.\n";
    }

    echo "Done.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
