<?php
/**
 * Public contact form. Saves the enquiry as a CRM inquiry (no email is sent).
 * POST /api/publicinquiry/create
 */
class PublicinquiryController extends Controller {
    private $apiClientModel;

    const TOPICS = ['General', 'Wholesale & bulk', 'Product question', 'Order help', 'Feedback'];

    public function __construct() {
        $this->apiClientModel = $this->model('ApiClient');
    }

    public function create() {
        if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') $this->error('Method Not Allowed', 405);

        $key = $_SERVER['HTTP_X_API_KEY'] ?? $_GET['api_key'] ?? '';
        if (empty($key) || !$this->apiClientModel->validate($key, $_SERVER['HTTP_ORIGIN'] ?? '')) {
            $this->error('Unauthorized', 403);
        }

        require_once '../app/helpers/PublicFormGuard.php';
        $data = json_decode(file_get_contents('php://input'), true);
        if (!is_array($data)) $this->error('Invalid input', 400);

        // Bots: answer as if it worked, but save nothing.
        if (PublicFormGuard::spamVerdict($data)) {
            $this->success(['received' => true], 'Thank you. Our team will be in touch shortly.');
        }
        PublicFormGuard::rateLimit($this, 'contact', 5, 60);

        $name = PublicFormGuard::text($data['name'] ?? '', 120);
        $email = strtolower(PublicFormGuard::text($data['email'] ?? '', 160));
        $phone = PublicFormGuard::text($data['phone'] ?? '', 20);
        $topic = PublicFormGuard::text($data['topic'] ?? 'General', 60);
        $message = trim((string)($data['message'] ?? ''));
        $newsletter = !empty($data['newsletter']);
        $privacy = !empty($data['privacyAccepted']);

        if (mb_strlen($name) < 2) $this->error('Please enter your name.', 400);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $this->error('Please enter a valid email address.', 400);
        if ($phone !== '' && !preg_match('/^\+?[0-9 ()-]{7,20}$/', $phone)) $this->error('Please enter a valid phone number.', 400);
        if (!in_array($topic, self::TOPICS, true)) $topic = 'General';
        if (mb_strlen($message) < 10) $this->error('Your message needs at least 10 characters.', 400);
        if (mb_strlen($message) > 1000) $this->error('Your message can be at most 1000 characters.', 400);
        if (PublicFormGuard::hasLink($message) || PublicFormGuard::hasLink($name)) $this->error('Links are not allowed in the message.', 400);
        if (!$privacy) $this->error('Please accept the privacy policy to send your message.', 400);

        require_once '../app/helpers/MarketResolver.php';
        $resolved = MarketResolver::forRequest($this->apiClientModel, null, $data['market'] ?? ($_GET['market'] ?? ''));
        $locationId = (int)($resolved['location_id'] ?? 0);
        if ($locationId <= 0) $this->error('Unknown or unavailable market', 400);

        $inquiry = $this->model('Inquiry');
        $id = $inquiry->create([
            'location_id' => $locationId,
            'customer_name' => $name,
            'email' => $email,
            'phone' => $phone ?: null,
            'source' => 'Website',
            'inquiry_type' => $topic,
            'status' => 'New',
            'requirements' => $message,
            'notes' => 'Newsletter: ' . ($newsletter ? 'yes' : 'no') . ' | Privacy policy accepted | Sent ' . date('Y-m-d H:i'),
            'userId' => null,
        ]);
        if (!$id) $this->error('Could not send your message. Please try again.', 500);
        PublicFormGuard::record('contact');

        if ($newsletter) {
            try {
                $this->model('Subscriber')->subscribe($email, $name, 'Contact form', $locationId, PublicFormGuard::ip());
            } catch (Exception $e) {
                error_log('[newsletter] contact opt-in failed: ' . $e->getMessage());
            }
        }

        $this->success(['id' => $id], 'Thank you. Our team will be in touch shortly.');
    }
}
