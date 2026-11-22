<?php
/**
 * Public newsletter sign-up / unsubscribe.
 * POST /api/publicsubscriber/subscribe          {email, name?, source?, market?}   (X-API-Key)
 * GET  /api/publicsubscriber/unsubscribe/{token} one-click link used in campaign emails
 */
class PublicsubscriberController extends Controller {
    private $apiClientModel;
    private $subscriberModel;

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
        $this->subscriberModel = $this->model('Subscriber');
    }

    public function subscribe() {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);

        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if (empty($key) || !$this->apiClientModel->validate($key, $_SERVER['HTTP_ORIGIN'] ?? '')) {
            $this->error('Unauthorized', 403);
        }

        require_once '../app/helpers/PublicFormGuard.php';
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) $this->error('Invalid input', 400);

        if (PublicFormGuard::spamVerdict($data)) {
            $this->success(['subscribed' => true], 'Thank you for subscribing.');
        }
        PublicFormGuard::rateLimit($this, 'newsletter', 5, 60);

        $email = strtolower(PublicFormGuard::text($data['email'] ?? '', 160));
        $name = PublicFormGuard::text($data['name'] ?? '', 120);
        $source = PublicFormGuard::text($data['source'] ?? 'Website', 40) ?: 'Website';
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->error('Please enter a valid email address.', 400);
        if (PublicFormGuard::hasLink($name)) $this->error('Links are not allowed in the name.', 400);

        $locationId = null;
        if (!empty($data['market']) || !empty($_GET['market'])) {
            require_once '../app/helpers/MarketResolver.php';
            $resolved = MarketResolver::forRequest($this->apiClientModel, null, $data['market'] ?? ($_GET['market'] ?? ''));
            $locationId = (int)($resolved['location_id'] ?? 0) ?: null;
        }

        [$id, $already] = $this->subscriberModel->subscribe($email, $name ?: null, $source, $locationId, PublicFormGuard::ip());
        PublicFormGuard::record('newsletter');

        $this->success(['subscribed' => true],
            $already ? 'You are already subscribed. Thank you!' : 'Thank you for subscribing.');
    }

    public function unsubscribe($token = null) {
        $token = preg_replace('/[^a-f0-9]/', '', (string)$token);
        $sub = $token ? $this->subscriberModel->findByToken($token) : null;
        if ($sub && $sub->status !== 'Unsubscribed') {
            $this->subscriberModel->setStatus((int)$sub->id, 'Unsubscribed');
        }
        header('Content-Type: text/html; charset=utf-8');
        $msg = $sub ? 'You have been unsubscribed. You will not receive our newsletter any more.'
                    : 'This unsubscribe link is invalid or has expired.';
        echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
           . '<title>Newsletter</title></head><body style="font-family:system-ui,sans-serif;display:flex;min-height:90vh;'
           . 'align-items:center;justify-content:center;background:#f6f6f4;color:#222;padding:16px">'
           . '<div style="max-width:420px;text-align:center;background:#fff;padding:32px;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06)">'
           . '<h1 style="font-size:20px;margin:0 0 12px">Newsletter</h1><p style="margin:0;line-height:1.5">'
           . htmlspecialchars($msg) . '</p></div></body></html>';
        exit;
    }
}
