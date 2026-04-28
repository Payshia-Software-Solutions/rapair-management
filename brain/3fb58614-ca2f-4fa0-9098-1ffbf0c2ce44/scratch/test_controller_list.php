<?php
require_once 'server/config/config.php';
require_once 'server/app/core/Database.php';
require_once 'server/app/core/Controller.php';
require_once 'server/app/core/Model.php';
require_once 'server/app/models/PaymentReceipt.php';
require_once 'server/app/controllers/PaymentreceiptController.php';

// Mock $_GET
$_GET['method'] = '';
$_GET['from_date'] = '';
$_GET['to_date'] = '';

class MockPaymentreceiptController extends PaymentreceiptController {
    public function json($data, $status = 200) {
        echo json_encode($data, JSON_PRETTY_PRINT);
        exit;
    }
}

$controller = new MockPaymentreceiptController();
$controller->list();
?>
