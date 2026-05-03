<?php
$base_dir = 'c:/xampp/htdocs/rapair-management/nexus-portal-server/app/';
spl_autoload_register(function ($class) use ($base_dir) {
    $prefix = 'App\\';
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) return;
    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    if (file_exists($file)) require $file;
});

$model = new \App\Models\SaaSInvoiceModel();
$month = date('F Y');
$data = [
    'tenant_id' => 1,
    'invoice_number' => 'TEST-' . time(),
    'amount' => 50.00,
    'billing_month' => $month,
    'due_date' => date('Y-m-d'),
    'status' => 'Pending'
];
$id = $model->create($data);
var_dump($id);
if (!$id) {
    echo "Create failed.\n";
}
