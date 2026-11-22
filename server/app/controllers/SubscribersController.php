<?php
/**
 * E-commerce newsletter subscribers (admin).
 * GET  /api/subscribers/index?status=&q=
 * POST /api/subscribers/store            {email, name?}
 * POST /api/subscribers/status/{id}      {status: Subscribed|Unsubscribed}
 * POST /api/subscribers/delete/{id}
 * GET  /api/subscribers/export           CSV of subscribed emails
 */
class SubscribersController extends Controller {
    private $subscriberModel;

    public function __construct() {
        $this->subscriberModel = $this->model('Subscriber');
    }

    public function index() {
        $this->requirePermission('customers.read');
        $status = $_GET['status'] ?? null;
        if (!in_array($status, ['Subscribed', 'Unsubscribed'], true)) $status = null;
        $q = trim((string)($_GET['q'] ?? ''));
        $this->success([
            'subscribers' => $this->subscriberModel->getAll($status, $q !== '' ? $q : null),
            'stats' => $this->subscriberModel->stats(),
        ]);
    }

    public function store() {
        $this->requirePermission('customers.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = strtolower(trim((string)($data['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->error('Please enter a valid email address.', 400);
        $name = trim((string)($data['name'] ?? '')) ?: null;
        [$id, $already] = $this->subscriberModel->subscribe($email, $name, 'Manual');
        $this->success(['id' => $id], $already ? 'This email is already subscribed.' : 'Subscriber added.');
    }

    public function status($id = null) {
        $this->requirePermission('customers.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Subscriber ID required', 400);
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $status = $data['status'] ?? '';
        if (!in_array($status, ['Subscribed', 'Unsubscribed'], true)) $this->error('Invalid status', 400);
        $this->subscriberModel->setStatus((int)$id, $status);
        $this->success([], 'Subscriber updated.');
    }

    public function delete($id = null) {
        $this->requirePermission('customers.write');
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);
        if (!$id) $this->error('Subscriber ID required', 400);
        $this->subscriberModel->delete((int)$id);
        $this->success([], 'Subscriber deleted.');
    }

    public function export() {
        $this->requirePermission('customers.read');
        $rows = $this->subscriberModel->getAll('Subscribed');
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="subscribers-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Email', 'Name', 'Source', 'Subscribed At']);
        foreach ($rows as $r) fputcsv($out, [$r->email, $r->name, $r->source, $r->subscribed_at]);
        fclose($out);
        exit;
    }
}
